#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <jxl/encode.h>
#ifdef __EMSCRIPTEN_PTHREADS__
#include <jxl/thread_parallel_runner.h>
#endif

#include <cmath>
#include <cstdint>
#include <limits>
#include <memory>
#include <vector>

using namespace emscripten;

thread_local const val Uint8Array = val::global("Uint8Array");

struct JXLOptions {
  int effort;
  float quality;
  bool progressive;
  int epf;
  bool lossyPalette;
  size_t decodingSpeedTier;
  float photonNoiseIso;
  bool lossyModular;
};

uint32_t version() {
  return JxlEncoderVersion();
}

bool setOption(JxlEncoderFrameSettings* settings, JxlEncoderFrameSettingId option, int value) {
  return JxlEncoderFrameSettingsSetOption(settings, option, value) == JXL_ENC_SUCCESS;
}

val encode(val image, int width, int height, JXLOptions options) {
  if (width <= 0 || height <= 0) {
    return val::null();
  }

  const size_t widthSize = static_cast<size_t>(width);
  const size_t heightSize = static_cast<size_t>(height);
  if (widthSize > std::numeric_limits<size_t>::max() / heightSize) {
    return val::null();
  }

  const size_t pixelCount = widthSize * heightSize;
  const size_t imageSize = image["length"].as<size_t>();
  if (pixelCount > std::numeric_limits<size_t>::max() / 4 || imageSize != pixelCount * 4) {
    return val::null();
  }

  std::vector<uint8_t> pixelData = convertJSArrayToNumberVector<uint8_t>(image);

  std::unique_ptr<JxlEncoder, decltype(&JxlEncoderDestroy)> encoder(JxlEncoderCreate(nullptr),
                                                                    JxlEncoderDestroy);
  if (!encoder) {
    return val::null();
  }

#ifdef __EMSCRIPTEN_PTHREADS__
  std::unique_ptr<void, decltype(&JxlThreadParallelRunnerDestroy)> runner(
      JxlThreadParallelRunnerCreate(nullptr, JxlThreadParallelRunnerDefaultNumWorkerThreads()),
      JxlThreadParallelRunnerDestroy);
  if (!runner || JxlEncoderSetParallelRunner(encoder.get(), JxlThreadParallelRunner,
                                             runner.get()) != JXL_ENC_SUCCESS) {
    return val::null();
  }
#endif

  JxlBasicInfo basicInfo;
  JxlEncoderInitBasicInfo(&basicInfo);
  basicInfo.xsize = static_cast<uint32_t>(width);
  basicInfo.ysize = static_cast<uint32_t>(height);
  basicInfo.bits_per_sample = 8;
  basicInfo.exponent_bits_per_sample = 0;
  basicInfo.num_color_channels = 3;
  basicInfo.num_extra_channels = 1;
  basicInfo.alpha_bits = 8;
  basicInfo.alpha_exponent_bits = 0;
  basicInfo.alpha_premultiplied = JXL_FALSE;
  basicInfo.uses_original_profile = options.quality == 100 && !options.lossyPalette;
  if (JxlEncoderSetBasicInfo(encoder.get(), &basicInfo) != JXL_ENC_SUCCESS) {
    return val::null();
  }

  JxlExtraChannelInfo alphaInfo;
  JxlEncoderInitExtraChannelInfo(JXL_CHANNEL_ALPHA, &alphaInfo);
  alphaInfo.bits_per_sample = 8;
  alphaInfo.alpha_premultiplied = JXL_FALSE;
  if (JxlEncoderSetExtraChannelInfo(encoder.get(), 0, &alphaInfo) != JXL_ENC_SUCCESS) {
    return val::null();
  }

  JxlColorEncoding colorEncoding;
  JxlColorEncodingSetToSRGB(&colorEncoding, JXL_FALSE);
  if (JxlEncoderSetColorEncoding(encoder.get(), &colorEncoding) != JXL_ENC_SUCCESS) {
    return val::null();
  }

  JxlEncoderFrameSettings* settings = JxlEncoderFrameSettingsCreate(encoder.get(), nullptr);
  if (!settings || !setOption(settings, JXL_ENC_FRAME_SETTING_EFFORT, options.effort) ||
      !setOption(settings, JXL_ENC_FRAME_SETTING_DECODING_SPEED,
                 static_cast<int>(options.decodingSpeedTier)) ||
      !setOption(settings, JXL_ENC_FRAME_SETTING_EPF, options.epf)) {
    return val::null();
  }

  if (JxlEncoderFrameSettingsSetFloatOption(settings, JXL_ENC_FRAME_SETTING_PHOTON_NOISE,
                                            options.photonNoiseIso) != JXL_ENC_SUCCESS) {
    return val::null();
  }

  const bool modular = options.lossyModular || options.quality == 100;
  if (!setOption(settings, JXL_ENC_FRAME_SETTING_MODULAR, modular ? 1 : 0)) {
    return val::null();
  }

  if (modular) {
    const float modularQuality =
        options.quality < 7 ? 35 + (options.quality - 7) * 3 : 35 + (options.quality - 7) * 65 / 93;
    if (options.quality == 100 && !options.lossyPalette) {
      if (JxlEncoderSetFrameLossless(settings, JXL_TRUE) != JXL_ENC_SUCCESS) {
        return val::null();
      }
    } else {
      const float qualityDistance = JxlEncoderDistanceFromQuality(modularQuality);
      const float distance = qualityDistance == 0 ? 0.01f : qualityDistance;
      const int colorTransform = options.quality == 100 ? 1 : 0;
      if (JxlEncoderSetFrameDistance(settings, distance) != JXL_ENC_SUCCESS ||
          !setOption(settings, JXL_ENC_FRAME_SETTING_COLOR_TRANSFORM, colorTransform)) {
        return val::null();
      }
    }
  } else {
    const float distance = options.quality >= 30
                               ? 0.1f + (100 - options.quality) * 0.09f
                               : 6.4f + std::pow(2.5f, (30 - options.quality) / 5.0f) / 6.25f;
    if (JxlEncoderSetFrameDistance(settings, distance) != JXL_ENC_SUCCESS) {
      return val::null();
    }
  }

  if (options.lossyPalette && (!setOption(settings, JXL_ENC_FRAME_SETTING_LOSSY_PALETTE, 1) ||
                               !setOption(settings, JXL_ENC_FRAME_SETTING_PALETTE_COLORS, 0) ||
                               !setOption(settings, JXL_ENC_FRAME_SETTING_MODULAR_PREDICTOR, 0) ||
                               !setOption(settings, JXL_ENC_FRAME_SETTING_RESPONSIVE, 0))) {
    return val::null();
  }

  if (options.progressive &&
      (!setOption(settings, JXL_ENC_FRAME_SETTING_QPROGRESSIVE_AC, 1) ||
       !setOption(settings, JXL_ENC_FRAME_SETTING_RESPONSIVE, 1) ||
       (!modular && !setOption(settings, JXL_ENC_FRAME_SETTING_PROGRESSIVE_DC, 1)))) {
    return val::null();
  }

  const JxlPixelFormat pixelFormat = {4, JXL_TYPE_UINT8, JXL_NATIVE_ENDIAN, 0};
  if (JxlEncoderAddImageFrame(settings, &pixelFormat, pixelData.data(), pixelData.size()) !=
      JXL_ENC_SUCCESS) {
    return val::null();
  }
  JxlEncoderCloseInput(encoder.get());

  std::vector<uint8_t> output(65536);
  uint8_t* nextOutput = output.data();
  size_t availableOutput = output.size();
  while (true) {
    const JxlEncoderStatus status =
        JxlEncoderProcessOutput(encoder.get(), &nextOutput, &availableOutput);
    if (status == JXL_ENC_SUCCESS)
      break;
    if (status != JXL_ENC_NEED_MORE_OUTPUT || output.size() > output.max_size() / 2) {
      return val::null();
    }

    const size_t outputSize = static_cast<size_t>(nextOutput - output.data());
    output.resize(output.size() * 2);
    nextOutput = output.data() + outputSize;
    availableOutput = output.size() - outputSize;
  }

  output.resize(static_cast<size_t>(nextOutput - output.data()));
  return Uint8Array.new_(typed_memory_view(output.size(), output.data()));
}

EMSCRIPTEN_BINDINGS(my_module) {
  value_object<JXLOptions>("JXLOptions")
      .field("effort", &JXLOptions::effort)
      .field("quality", &JXLOptions::quality)
      .field("progressive", &JXLOptions::progressive)
      .field("lossyPalette", &JXLOptions::lossyPalette)
      .field("decodingSpeedTier", &JXLOptions::decodingSpeedTier)
      .field("photonNoiseIso", &JXLOptions::photonNoiseIso)
      .field("lossyModular", &JXLOptions::lossyModular)
      .field("epf", &JXLOptions::epf);

  function("encode", &encode);
  function("version", &version);
}
