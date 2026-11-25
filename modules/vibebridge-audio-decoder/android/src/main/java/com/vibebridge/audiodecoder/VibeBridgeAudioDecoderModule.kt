package com.vibebridge.audiodecoder

import android.content.res.AssetFileDescriptor
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaCodecList
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * VibeBridgeAudioDecoderModule (Stage 2 Phase 2 - Milestone 1)
 *
 * Implements pull-based, bounded-memory Android MediaExtractor + MediaCodec PCM decoding.
 * Preserves the native decoded sample rate and channel count without implicit downsampling,
 * normalizes Android PCM output encodings to little-endian signed 16-bit PCM (`int16`),
 * supports file://, raw paths, and content:// SAF URIs, and allows deterministic cancellation.
 */
class VibeBridgeAudioDecoderModule : Module() {

  private data class DecodeSession(
    val id: String,
    val uri: String,
    val extractor: MediaExtractor,
    var codec: MediaCodec?,
    var afd: AssetFileDescriptor?,
    val isRawPassthrough: Boolean,
    val mimeType: String,
    val codecName: String,
    var sampleRate: Int,
    var channelCount: Int,
    var nativePcmEncoding: Int,
    val durationUs: Long,
    val targetChunkDurationMs: Int,
    var maxChunkBytes: Int,
    @Volatile var cancelled: Boolean = false,
    @Volatile var closed: Boolean = false,
    var inputDone: Boolean = false,
    var outputDone: Boolean = false,
    var chunkIndex: Int = 0,
    var totalFramesDecoded: Long = 0L,
    var totalPcmBytesDecoded: Long = 0L,
    var lastPtsUs: Long = 0L,
    val lock: Any = Any()
  )

  private val sessions = ConcurrentHashMap<String, DecodeSession>()

  override fun definition() = ModuleDefinition {
    Name("VibeBridgeAudioDecoder")

    OnDestroy {
      cleanupAllSessions()
    }

    Function("isAvailable") {
      true
    }

    AsyncFunction("getAvailabilityAsync") {
      val codecList = MediaCodecList(MediaCodecList.REGULAR_CODECS)
      val decoderMimes = mutableSetOf<String>()

      for (info in codecList.codecInfos) {
        if (info.isEncoder) continue
        for (mime in info.supportedTypes) {
          val normalized = mime.lowercase()
          if (normalized.startsWith("audio/")) {
            decoderMimes.add(normalized)
          }
        }
      }

      val formatMimeMap = mapOf(
        "mp3" to listOf("audio/mpeg"),
        "m4a" to listOf("audio/mp4a-latm", "audio/aac"),
        "aac" to listOf("audio/mp4a-latm", "audio/aac"),
        "flac" to listOf("audio/flac"),
        "ogg" to listOf("audio/vorbis", "audio/opus"),
        "wav" to listOf("audio/raw")
      )

      val supportedFormats = mutableListOf<String>()
      val codecDetails = mutableMapOf<String, Boolean>()

      for ((ext, mimes) in formatMimeMap) {
        val supported = mimes.any { decoderMimes.contains(it) }
        codecDetails[ext] = supported
        if (supported) {
          supportedFormats.add(ext)
        }
      }

      mapOf(
        "moduleInstalled" to true,
        "moduleAvailable" to true,
        "capabilitySupported" to supportedFormats.isNotEmpty(),
        "decoderImplemented" to true,
        "status" to "executed",
        "supportedFormats" to supportedFormats,
        "codecDetails" to codecDetails,
        "androidSdkInt" to Build.VERSION.SDK_INT,
        "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL}".trim(),
        "note" to "Native MediaExtractor + MediaCodec bounded PCM streaming decoder active (sample rate preserved)."
      )
    }

    AsyncFunction("probeAudioFileAsync") { uri: String ->
      probeAudioFileInternal(uri)
    }

    AsyncFunction("openDecodeSessionAsync") { uri: String, chunkDurationMs: Int?, maxChunkBytes: Int? ->
      openDecodeSessionInternal(uri, chunkDurationMs ?: DEFAULT_CHUNK_DURATION_MS, maxChunkBytes ?: DEFAULT_MAX_CHUNK_BYTES)
    }

    AsyncFunction("readNextPcmChunkAsync") { sessionId: String ->
      readNextPcmChunkInternal(sessionId)
    }

    AsyncFunction("cancelDecodeSessionAsync") { sessionId: String ->
      val session = sessions[sessionId] ?: return@AsyncFunction false
      session.cancelled = true
      synchronized(session.lock) {
        closeSessionInternal(session)
      }
      true
    }

    AsyncFunction("closeDecodeSessionAsync") { sessionId: String ->
      val session = sessions[sessionId] ?: return@AsyncFunction false
      synchronized(session.lock) {
        closeSessionInternal(session)
      }
      true
    }
  }

  private fun baseDeviceInfo(): MutableMap<String, Any?> = mutableMapOf(
    "moduleInstalled" to true,
    "moduleAvailable" to true,
    "decoderImplemented" to true,
    "androidSdkInt" to Build.VERSION.SDK_INT,
    "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL}".trim()
  )

  private fun failureResult(
    errorCode: String,
    message: String,
    capabilitySupported: Boolean = false,
    status: String = "failed",
    extra: Map<String, Any?> = emptyMap()
  ): Map<String, Any?> {
    val map = baseDeviceInfo()
    map["capabilitySupported"] = capabilitySupported
    map["status"] = status
    map["errorCode"] = errorCode
    map["error"] = message
    map.putAll(extra)
    return map
  }

  private fun configureDataSource(
    extractor: MediaExtractor,
    uriString: String
  ): AssetFileDescriptor? {
    val trimmed = uriString.trim()
    if (trimmed.isEmpty()) {
      throw DecodeFailureException("FILE_NOT_FOUND", "Empty audio URI supplied.")
    }

    if (trimmed.startsWith("content://", ignoreCase = true)) {
      val context = appContext.reactContext
        ?: throw DecodeFailureException("UNAVAILABLE", "Android React context unavailable for content URI.")
      val afd = context.contentResolver.openAssetFileDescriptor(Uri.parse(trimmed), "r")
        ?: throw DecodeFailureException("FILE_NOT_FOUND", "Unable to open content URI: $trimmed")
      try {
        if (afd.declaredLength >= 0L) {
          extractor.setDataSource(afd.fileDescriptor, afd.startOffset, afd.declaredLength)
        } else {
          extractor.setDataSource(afd.fileDescriptor)
        }
      } catch (t: Throwable) {
        try { afd.close() } catch (_: Throwable) {}
        throw DecodeFailureException("CORRUPT_OR_INVALID_AUDIO", "Extractor rejected content source: ${t.message}")
      }
      return afd
    }

    val filePath = if (trimmed.startsWith("file://", ignoreCase = true)) {
      Uri.parse(trimmed).path ?: trimmed.removePrefix("file://")
    } else {
      trimmed
    }

    val file = File(filePath)
    if (!file.exists() || !file.isFile || !file.canRead() || file.length() <= 0L) {
      throw DecodeFailureException("FILE_NOT_FOUND", "Audio file missing, empty, or unreadable: $filePath")
    }

    try {
      extractor.setDataSource(file.absolutePath)
    } catch (t: Throwable) {
      throw DecodeFailureException("CORRUPT_OR_INVALID_AUDIO", "MediaExtractor failed to parse container: ${t.message}")
    }
    return null
  }

  private fun selectFirstAudioTrack(extractor: MediaExtractor): Pair<Int, MediaFormat> {
    val trackCount = extractor.trackCount
    for (i in 0 until trackCount) {
      val format = extractor.getTrackFormat(i)
      val mime = format.getString(MediaFormat.KEY_MIME)?.lowercase() ?: continue
      if (mime.startsWith("audio/")) {
        extractor.selectTrack(i)
        return Pair(i, format)
      }
    }
    throw DecodeFailureException("NO_AUDIO_TRACK", "Container contains no audio stream (trackCount=$trackCount).")
  }

  private fun readIntOrDefault(format: MediaFormat, key: String, defaultValue: Int): Int {
    return try {
      if (format.containsKey(key)) format.getInteger(key) else defaultValue
    } catch (_: Throwable) {
      defaultValue
    }
  }

  private fun readLongOrDefault(format: MediaFormat, key: String, defaultValue: Long): Long {
    return try {
      if (format.containsKey(key)) format.getLong(key) else defaultValue
    } catch (_: Throwable) {
      defaultValue
    }
  }

  private fun isCodecAvailableForMime(mimeType: String): Boolean {
    if (mimeType == "audio/raw") return true
    val codecList = MediaCodecList(MediaCodecList.REGULAR_CODECS)
    for (info in codecList.codecInfos) {
      if (info.isEncoder) continue
      if (info.supportedTypes.any { it.equals(mimeType, ignoreCase = true) }) {
        return true
      }
    }
    return false
  }

  private fun pcmEncodingLabel(encoding: Int): String {
    if (encoding == AudioFormat.ENCODING_PCM_FLOAT) return "float32"
    if (encoding == AudioFormat.ENCODING_PCM_8BIT) return "uint8"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (encoding == AudioFormat.ENCODING_PCM_24BIT_PACKED) return "int24"
      if (encoding == AudioFormat.ENCODING_PCM_32BIT) return "int32"
    }
    return "int16"
  }

  private fun probeAudioFileInternal(uri: String): Map<String, Any?> {
    val extractor = MediaExtractor()
    var afd: AssetFileDescriptor? = null
    var codec: MediaCodec? = null

    try {
      afd = configureDataSource(extractor, uri)
      val (_, format) = selectFirstAudioTrack(extractor)
      val mime = format.getString(MediaFormat.KEY_MIME)?.lowercase()
        ?: return failureResult("NO_AUDIO_TRACK", "Audio track has missing MIME type.")
      val sampleRate = readIntOrDefault(format, MediaFormat.KEY_SAMPLE_RATE, 0)
      val channelCount = readIntOrDefault(format, MediaFormat.KEY_CHANNEL_COUNT, 0)
      val durationUs = readLongOrDefault(format, MediaFormat.KEY_DURATION, -1L)
      val nativeEncoding = readIntOrDefault(format, MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)

      if (!isCodecAvailableForMime(mime)) {
        return failureResult(
          "UNSUPPORTED_CODEC",
          "No Android decoder registered for MIME type '$mime'.",
          capabilitySupported = false,
          status = "unsupported",
          extra = mapOf("mimeType" to mime, "sampleRate" to sampleRate, "channelCount" to channelCount)
        )
      }

      var codecName = "raw-pcm-extractor"
      if (mime != "audio/raw") {
        try {
          codec = MediaCodec.createDecoderByType(mime)
          codec.configure(format, null, null, 0)
          codecName = codec.codecInfo.name
        } catch (t: Throwable) {
          return failureResult(
            "UNSUPPORTED_CODEC",
            "MediaCodec failed to configure decoder for '$mime': ${t.message}",
            capabilitySupported = false,
            status = "unsupported",
            extra = mapOf("mimeType" to mime, "sampleRate" to sampleRate, "channelCount" to channelCount)
          )
        }
      }

      val map = baseDeviceInfo()
      map["capabilitySupported"] = true
      map["status"] = "executed"
      map["supported"] = true
      map["mimeType"] = mime
      map["codecName"] = codecName
      map["sampleRate"] = sampleRate
      map["channelCount"] = channelCount
      map["nativePcmEncoding"] = pcmEncodingLabel(nativeEncoding)
      map["durationMs"] = if (durationUs > 0L) durationUs / 1000.0 else 0.0
      return map
    } catch (e: DecodeFailureException) {
      val status = if (e.errorCode == "UNSUPPORTED_CODEC") "unsupported" else "failed"
      return failureResult(e.errorCode, e.message ?: "Probe failed.", capabilitySupported = false, status = status)
    } catch (t: Throwable) {
      return failureResult("DECODE_ERROR", t.message ?: "Unexpected probe error.")
    } finally {
      try { codec?.release() } catch (_: Throwable) {}
      try { extractor.release() } catch (_: Throwable) {}
      try { afd?.close() } catch (_: Throwable) {}
    }
  }

  private fun computeTargetBytes(sampleRate: Int, channelCount: Int, chunkDurationMs: Int, maxChunkBytes: Int): Int {
    val safeRate = if (sampleRate > 0) sampleRate else 44100
    val safeChannels = if (channelCount > 0) channelCount else 1
    val frameBytes = safeChannels * 2 // int16 output
    val desiredBytes = ((safeRate.toLong() * safeChannels * 2L * chunkDurationMs) / 1000L).toInt()
    val clamped = max(frameBytes * 256, min(desiredBytes, maxChunkBytes))
    return (clamped / frameBytes) * frameBytes
  }

  private fun openDecodeSessionInternal(
    uri: String,
    requestedChunkDurationMs: Int,
    requestedMaxChunkBytes: Int
  ): Map<String, Any?> {
    val extractor = MediaExtractor()
    var afd: AssetFileDescriptor? = null
    var codec: MediaCodec? = null

    try {
      afd = configureDataSource(extractor, uri)
      val (_, format) = selectFirstAudioTrack(extractor)
      val mime = format.getString(MediaFormat.KEY_MIME)?.lowercase()
        ?: return failureResult("NO_AUDIO_TRACK", "Audio track has missing MIME type.")

      val initialSampleRate = readIntOrDefault(format, MediaFormat.KEY_SAMPLE_RATE, 0)
      val initialChannels = readIntOrDefault(format, MediaFormat.KEY_CHANNEL_COUNT, 1)
      val durationUs = readLongOrDefault(format, MediaFormat.KEY_DURATION, -1L)
      val initialEncoding = readIntOrDefault(format, MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)

      if (!isCodecAvailableForMime(mime)) {
        throw DecodeFailureException("UNSUPPORTED_CODEC", "No Android decoder available for '$mime'.")
      }

      var isRawPassthrough = false
      var codecName = "raw-pcm-extractor"
      if (mime == "audio/raw") {
        try {
          val rawCodec = MediaCodec.createDecoderByType(mime)
          rawCodec.configure(format, null, null, 0)
          rawCodec.start()
          codec = rawCodec
          codecName = rawCodec.codecInfo.name
        } catch (_: Throwable) {
          // Many Android devices expose audio/raw directly from MediaExtractor without a codec
          codec = null
          isRawPassthrough = true
        }
      } else {
        try {
          val decoder = MediaCodec.createDecoderByType(mime)
          decoder.configure(format, null, null, 0)
          decoder.start()
          codec = decoder
          codecName = decoder.codecInfo.name
        } catch (t: Throwable) {
          try { codec?.release() } catch (_: Throwable) {}
          throw DecodeFailureException(
            "UNSUPPORTED_CODEC",
            "Failed to start MediaCodec decoder for '$mime': ${t.message}"
          )
        }
      }

      if (initialSampleRate <= 0 && codec == null) {
        throw DecodeFailureException("CORRUPT_OR_INVALID_AUDIO", "Missing sample rate for raw PCM track.")
      }

      val chunkDurationMs = requestedChunkDurationMs.coerceIn(100, 2000)
      val maxChunkBytes = requestedMaxChunkBytes.coerceIn(16384, HARD_MAX_CHUNK_BYTES)
      val targetChunkBytes = computeTargetBytes(
        if (initialSampleRate > 0) initialSampleRate else 44100,
        if (initialChannels > 0) initialChannels else 1,
        chunkDurationMs,
        maxChunkBytes
      )

      val sessionId = UUID.randomUUID().toString()
      val session = DecodeSession(
        id = sessionId,
        uri = uri,
        extractor = extractor,
        codec = codec,
        afd = afd,
        isRawPassthrough = isRawPassthrough,
        mimeType = mime,
        codecName = codecName,
        sampleRate = initialSampleRate,
        channelCount = max(1, initialChannels),
        nativePcmEncoding = initialEncoding,
        durationUs = durationUs,
        targetChunkDurationMs = chunkDurationMs,
        maxChunkBytes = maxChunkBytes
      )
      session.maxChunkBytes = targetChunkBytes

      sessions[sessionId] = session

      val response = baseDeviceInfo()
      response["capabilitySupported"] = true
      response["status"] = "executed"
      response["sessionId"] = sessionId
      response["mimeType"] = mime
      response["codecName"] = codecName
      response["sampleRate"] = session.sampleRate
      response["channelCount"] = session.channelCount
      response["pcmEncoding"] = "int16"
      response["nativePcmEncoding"] = pcmEncodingLabel(initialEncoding)
      response["durationMs"] = if (durationUs > 0L) durationUs / 1000.0 else 0.0
      response["chunkDurationMs"] = chunkDurationMs
      response["maxChunkBytes"] = session.maxChunkBytes
      return response
    } catch (e: DecodeFailureException) {
      try { codec?.stop() } catch (_: Throwable) {}
      try { codec?.release() } catch (_: Throwable) {}
      try { extractor.release() } catch (_: Throwable) {}
      try { afd?.close() } catch (_: Throwable) {}
      val status = if (e.errorCode == "UNSUPPORTED_CODEC") "unsupported" else "failed"
      return failureResult(e.errorCode, e.message ?: "Failed opening audio session.", capabilitySupported = false, status = status)
    } catch (t: Throwable) {
      try { codec?.stop() } catch (_: Throwable) {}
      try { codec?.release() } catch (_: Throwable) {}
      try { extractor.release() } catch (_: Throwable) {}
      try { afd?.close() } catch (_: Throwable) {}
      return failureResult("DECODE_ERROR", t.message ?: "Unexpected session open error.")
    }
  }

  private class PcmChunkAccumulator {
    val out = ByteArrayOutputStream()
    var sumSquares = 0.0
    var sampleCount = 0L
    var maxAbsNorm = 0.0
    var hasFirstPts = false
    var firstPtsUs = 0L

    fun appendNormalizedSample(sampleInt16: Int) {
      out.write(sampleInt16 and 0xFF)
      out.write((sampleInt16 shr 8) and 0xFF)
      val norm = sampleInt16 / 32768.0
      sumSquares += norm * norm
      val absVal = abs(norm)
      if (absVal > maxAbsNorm) maxAbsNorm = absVal
      sampleCount++
    }
  }

  private fun appendPcmBuffer(
    buffer: ByteBuffer,
    size: Int,
    nativeEncoding: Int,
    acc: PcmChunkAccumulator
  ) {
    val dup = buffer.duplicate()
    dup.order(ByteOrder.LITTLE_ENDIAN)

    if (nativeEncoding == AudioFormat.ENCODING_PCM_FLOAT) {
      val floatCount = size / 4
      for (i in 0 until floatCount) {
        val f = dup.float.coerceIn(-1.0f, 1.0f)
        val s = (f * 32767.0f).toInt().coerceIn(-32768, 32767)
        acc.appendNormalizedSample(s)
      }
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && nativeEncoding == AudioFormat.ENCODING_PCM_32BIT) {
      val intCount = size / 4
      for (i in 0 until intCount) {
        val s32 = dup.int
        val s16 = (s32 shr 16).coerceIn(-32768, 32767)
        acc.appendNormalizedSample(s16)
      }
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && nativeEncoding == AudioFormat.ENCODING_PCM_24BIT_PACKED) {
      val sampleCount24 = size / 3
      for (i in 0 until sampleCount24) {
        dup.get() // drop LSB
        val b1 = dup.get().toInt() and 0xFF
        val b2 = dup.get().toInt() // signed MSB
        val s16 = ((b2 shl 8) or b1).toShort().toInt()
        acc.appendNormalizedSample(s16)
      }
      return
    }

    if (nativeEncoding == AudioFormat.ENCODING_PCM_8BIT) {
      for (i in 0 until size) {
        val u = dup.get().toInt() and 0xFF
        val s16 = ((u - 128) shl 8).coerceIn(-32768, 32767)
        acc.appendNormalizedSample(s16)
      }
      return
    }

    // Default: signed little-endian 16-bit PCM
    val sampleCount16 = size / 2
    for (i in 0 until sampleCount16) {
      val s = dup.short.toInt()
      acc.appendNormalizedSample(s)
    }
  }

  private fun readNextPcmChunkInternal(sessionId: String): Map<String, Any?> {
    val session = sessions[sessionId]
      ?: return failureResult("INVALID_SESSION", "Decode session not found or already closed: $sessionId")

    synchronized(session.lock) {
      if (session.cancelled) {
        closeSessionInternal(session)
        val res = baseDeviceInfo()
        res["capabilitySupported"] = true
        res["status"] = "executed"
        res["errorCode"] = "CANCELLED"
        res["sessionId"] = sessionId
        res["chunkIndex"] = session.chunkIndex
        res["sampleRate"] = session.sampleRate
        res["channelCount"] = session.channelCount
        res["pcmEncoding"] = "int16"
        res["nativePcmEncoding"] = pcmEncodingLabel(session.nativePcmEncoding)
        res["frameCount"] = 0
        res["byteLength"] = 0
        res["pcmData"] = ByteArray(0)
        res["startTimeMs"] = session.lastPtsUs / 1000.0
        res["endTimeMs"] = session.lastPtsUs / 1000.0
        res["rms"] = 0.0
        res["peak"] = 0.0
        res["progress"] = 0.0
        res["isLastChunk"] = true
        res["cancelled"] = true
        return res
      }

      if (session.closed || session.outputDone) {
        closeSessionInternal(session)
        val endMs = session.lastPtsUs / 1000.0
        val res = baseDeviceInfo()
        res["capabilitySupported"] = true
        res["status"] = "executed"
        res["sessionId"] = sessionId
        res["chunkIndex"] = session.chunkIndex
        res["sampleRate"] = session.sampleRate
        res["channelCount"] = session.channelCount
        res["pcmEncoding"] = "int16"
        res["nativePcmEncoding"] = pcmEncodingLabel(session.nativePcmEncoding)
        res["frameCount"] = 0
        res["byteLength"] = 0
        res["pcmData"] = ByteArray(0)
        res["startTimeMs"] = endMs
        res["endTimeMs"] = endMs
        res["rms"] = 0.0
        res["peak"] = 0.0
        res["progress"] = 1.0
        res["isLastChunk"] = true
        res["cancelled"] = false
        return res
      }

      val acc = PcmChunkAccumulator()
      val bufferInfo = MediaCodec.BufferInfo()
      var noProgressLoops = 0

      try {
        if (session.isRawPassthrough) {
          val readBuffer = ByteBuffer.allocate(RAW_READ_BUFFER_SIZE)
          while (acc.out.size() < session.maxChunkBytes && !session.outputDone && !session.cancelled) {
            readBuffer.clear()
            val sampleSize = session.extractor.readSampleData(readBuffer, 0)
            if (sampleSize < 0) {
              session.outputDone = true
              break
            }
            val ptsUs = max(0L, session.extractor.sampleTime)
            if (!acc.hasFirstPts) {
              acc.hasFirstPts = true
              acc.firstPtsUs = ptsUs
            }
            readBuffer.position(0)
            readBuffer.limit(sampleSize)
            appendPcmBuffer(readBuffer, sampleSize, session.nativePcmEncoding, acc)
            session.lastPtsUs = ptsUs
            session.extractor.advance()
          }
        } else {
          val codec = session.codec
            ?: throw DecodeFailureException("DECODE_ERROR", "Missing MediaCodec instance.")

          while (acc.out.size() < session.maxChunkBytes && !session.outputDone && !session.cancelled) {
            var madeProgress = false

            if (!session.inputDone) {
              val inIndex = codec.dequeueInputBuffer(CODEC_TIMEOUT_US)
              if (inIndex >= 0) {
                madeProgress = true
                val inputBuf = codec.getInputBuffer(inIndex)
                if (inputBuf != null) {
                  inputBuf.clear()
                  val sampleSize = session.extractor.readSampleData(inputBuf, 0)
                  if (sampleSize < 0) {
                    codec.queueInputBuffer(inIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                    session.inputDone = true
                  } else {
                    val sampleTimeUs = max(0L, session.extractor.sampleTime)
                    codec.queueInputBuffer(inIndex, 0, sampleSize, sampleTimeUs, 0)
                    session.extractor.advance()
                  }
                }
              }
            }

            val outIndex = codec.dequeueOutputBuffer(bufferInfo, CODEC_TIMEOUT_US)
            when {
              outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                madeProgress = true
                val outFormat = codec.outputFormat
                val newRate = readIntOrDefault(outFormat, MediaFormat.KEY_SAMPLE_RATE, session.sampleRate)
                val newChannels = readIntOrDefault(outFormat, MediaFormat.KEY_CHANNEL_COUNT, session.channelCount)
                val newEnc = readIntOrDefault(outFormat, MediaFormat.KEY_PCM_ENCODING, session.nativePcmEncoding)

                if (acc.out.size() > 0 && (newRate != session.sampleRate || newChannels != session.channelCount)) {
                  // Emit already-buffered audio using previous format before adopting the new format
                  session.sampleRate = newRate
                  session.channelCount = newChannels
                  session.nativePcmEncoding = newEnc
                  break
                }

                session.sampleRate = newRate
                session.channelCount = max(1, newChannels)
                session.nativePcmEncoding = newEnc
                session.maxChunkBytes = computeTargetBytes(
                  session.sampleRate,
                  session.channelCount,
                  session.targetChunkDurationMs,
                  HARD_MAX_CHUNK_BYTES
                )
              }

              outIndex >= 0 -> {
                madeProgress = true
                if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && bufferInfo.size > 0) {
                  val outBuf = codec.getOutputBuffer(outIndex)
                  if (outBuf != null) {
                    outBuf.position(bufferInfo.offset)
                    outBuf.limit(bufferInfo.offset + bufferInfo.size)
                    val ptsUs = max(0L, bufferInfo.presentationTimeUs)
                    if (!acc.hasFirstPts) {
                      acc.hasFirstPts = true
                      acc.firstPtsUs = ptsUs
                    }
                    appendPcmBuffer(outBuf, bufferInfo.size, session.nativePcmEncoding, acc)
                    session.lastPtsUs = ptsUs
                  }
                }

                val isEos = (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
                codec.releaseOutputBuffer(outIndex, false)
                if (isEos) {
                  session.outputDone = true
                }
              }

              outIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> {
                // Wait cleanly up to guard limit
              }
            }

            if (madeProgress) {
              noProgressLoops = 0
            } else {
              noProgressLoops++
              if (noProgressLoops > MAX_NO_PROGRESS_LOOPS) {
                throw DecodeFailureException(
                  "DECODE_ERROR",
                  "MediaCodec timed out after repeated empty cycles for ${session.mimeType}."
                )
              }
            }
          }
        }

        if (session.cancelled) {
          closeSessionInternal(session)
          val res = baseDeviceInfo()
          res["capabilitySupported"] = true
          res["status"] = "executed"
          res["errorCode"] = "CANCELLED"
          res["sessionId"] = sessionId
          res["chunkIndex"] = session.chunkIndex
          res["sampleRate"] = session.sampleRate
          res["channelCount"] = session.channelCount
          res["pcmEncoding"] = "int16"
          res["nativePcmEncoding"] = pcmEncodingLabel(session.nativePcmEncoding)
          res["frameCount"] = 0
          res["byteLength"] = 0
          res["pcmData"] = ByteArray(0)
          res["startTimeMs"] = session.lastPtsUs / 1000.0
          res["endTimeMs"] = session.lastPtsUs / 1000.0
          res["rms"] = 0.0
          res["peak"] = 0.0
          res["progress"] = 0.0
          res["isLastChunk"] = true
          res["cancelled"] = true
          return res
        }

        val pcmBytes = acc.out.toByteArray()
        val byteLen = pcmBytes.size
        val frameBytes = max(2, session.channelCount * 2)
        val frameCount = byteLen / frameBytes

        // Check for empty/corrupt stream yielding zero decoded frames across entire input
        if (session.outputDone && session.totalFramesDecoded == 0L && frameCount == 0) {
          closeSessionInternal(session)
          return failureResult(
            "CORRUPT_OR_INVALID_AUDIO",
            "Audio decoder reached end of stream with 0 PCM frames decoded."
          )
        }

        session.totalFramesDecoded += frameCount
        session.totalPcmBytesDecoded += byteLen

        val rate = max(1, session.sampleRate)
        val chunkDurationMs = (frameCount.toDouble() * 1000.0) / rate.toDouble()
        val startTimeMs = if (acc.hasFirstPts) acc.firstPtsUs / 1000.0 else session.lastPtsUs / 1000.0
        val endTimeMs = startTimeMs + chunkDurationMs
        session.lastPtsUs = (endTimeMs * 1000.0).toLong()

        val rms = if (acc.sampleCount > 0) sqrt(acc.sumSquares / acc.sampleCount.toDouble()) else 0.0
        val peak = acc.maxAbsNorm

        val progress = when {
          session.outputDone -> 1.0
          session.durationUs > 0L -> ((endTimeMs * 1000.0) / session.durationUs.toDouble()).coerceIn(0.0, 0.999)
          else -> 0.5
        }

        val idx = session.chunkIndex
        session.chunkIndex++

        if (session.outputDone) {
          closeSessionInternal(session)
        }

        val res = baseDeviceInfo()
        res["capabilitySupported"] = true
        res["status"] = "executed"
        res["sessionId"] = sessionId
        res["chunkIndex"] = idx
        res["sampleRate"] = session.sampleRate
        res["channelCount"] = session.channelCount
        res["pcmEncoding"] = "int16"
        res["nativePcmEncoding"] = pcmEncodingLabel(session.nativePcmEncoding)
        res["frameCount"] = frameCount
        res["byteLength"] = byteLen
        res["pcmData"] = pcmBytes
        res["startTimeMs"] = startTimeMs
        res["endTimeMs"] = endTimeMs
        res["rms"] = rms
        res["peak"] = peak
        res["progress"] = progress
        res["isLastChunk"] = session.outputDone
        res["cancelled"] = false
        return res
      } catch (e: DecodeFailureException) {
        closeSessionInternal(session)
        return failureResult(e.errorCode, e.message ?: "Decode error.")
      } catch (t: Throwable) {
        closeSessionInternal(session)
        return failureResult("CORRUPT_OR_INVALID_AUDIO", t.message ?: "Native MediaCodec decode exception.")
      }
    }
  }

  private fun closeSessionInternal(session: DecodeSession) {
    if (session.closed) return
    session.closed = true
    sessions.remove(session.id)
    try { session.codec?.stop() } catch (_: Throwable) {}
    try { session.codec?.release() } catch (_: Throwable) {}
    session.codec = null
    try { session.extractor.release() } catch (_: Throwable) {}
    try { session.afd?.close() } catch (_: Throwable) {}
    session.afd = null
  }

  private fun cleanupAllSessions() {
    val active = sessions.values.toList()
    for (session in active) {
      synchronized(session.lock) {
        session.cancelled = true
        closeSessionInternal(session)
      }
    }
    sessions.clear()
  }

  private class DecodeFailureException(
    val errorCode: String,
    message: String
  ) : RuntimeException(message)

  companion object {
    private const val DEFAULT_CHUNK_DURATION_MS = 500
    private const val DEFAULT_MAX_CHUNK_BYTES = 262144
    private const val HARD_MAX_CHUNK_BYTES = 524288
    private const val RAW_READ_BUFFER_SIZE = 32768
    private const val CODEC_TIMEOUT_US = 5000L
    private const val MAX_NO_PROGRESS_LOOPS = 400
  }
}
