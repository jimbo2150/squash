#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "avif/avif.h"

#include <cstdint>
#include <memory>
#include <string>

using namespace emscripten;

thread_local const val Uint8ClampedArray = val::global("Uint8ClampedArray");
thread_local const val ImageData = val::global("ImageData");

val decode(std::string avifimage) {
  std::unique_ptr<avifImage, decltype(&avifImageDestroy)> image(avifImageCreateEmpty(),
                                                                avifImageDestroy);
  if (!image)
    return val::null();

  std::unique_ptr<avifDecoder, decltype(&avifDecoderDestroy)> decoder(avifDecoderCreate(),
                                                                      avifDecoderDestroy);
  if (!decoder)
    return val::null();

  const avifResult decodeResult =
      avifDecoderReadMemory(decoder.get(), image.get(),
                            reinterpret_cast<const uint8_t*>(avifimage.data()), avifimage.size());
  decoder.reset();

  val result = val::null();
  if (decodeResult == AVIF_RESULT_OK) {
    avifRGBImage rgb;
    avifRGBImageSetDefaults(&rgb, image.get());
    rgb.depth = 8;

    if (avifRGBImageAllocatePixels(&rgb) == AVIF_RESULT_OK) {
      if (avifImageYUVToRGB(image.get(), &rgb) == AVIF_RESULT_OK) {
        result = ImageData.new_(
            Uint8ClampedArray.new_(typed_memory_view(rgb.rowBytes * rgb.height, rgb.pixels)),
            rgb.width, rgb.height);
      }
      avifRGBImageFreePixels(&rgb);
    }
  }

  return result;
}

EMSCRIPTEN_BINDINGS(my_module) {
  function("decode", &decode);
}
