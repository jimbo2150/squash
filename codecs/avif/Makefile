# using libavif from https://github.com/AOMediaCodec/libavif
LIBAVIF_VERSION = 1.4.2
LIBAVIF_URL = https://github.com/AOMediaCodec/libavif/archive/refs/tags/v$(LIBAVIF_VERSION).tar.gz
LIBAVIF_PACKAGE = node_modules/libavif-v$(LIBAVIF_VERSION).tar.gz

# using libaom from https://aomedia.googlesource.com/aom
LIBAOM_VERSION = 3.14.1
LIBAOM_URL = https://aomedia.googlesource.com/aom/+archive/v$(LIBAOM_VERSION).tar.gz
LIBAOM_PACKAGE = node_modules/libaom-v$(LIBAOM_VERSION).tar.gz

export CODEC_DIR = node_modules/libavif
export BUILD_DIR = node_modules/build
export LIBAOM_DIR = node_modules/libaom
LIBAVIF_SOURCE_STAMP := $(CODEC_DIR)/.source-v$(LIBAVIF_VERSION)
LIBAOM_SOURCE_STAMP := $(LIBAOM_DIR)/.source-v$(LIBAOM_VERSION)

override CFLAGS += "-Wno-unused-macros"

# We must build libsharpyuv from the release used by libavif
# See libavif/ext/libsharpyuv.cmd for more detail
LIBWEBP_VERSION = v1.6.0
LIBWEBP_URL_WITH_SHARPYUV = https://chromium.googlesource.com/webm/libwebp/+archive/refs/tags/$(LIBWEBP_VERSION).tar.gz
LIBWEBP_DIR := $(CODEC_DIR)/ext/libwebp
LIBWEBP_SOURCE_STAMP := $(LIBWEBP_DIR)/.source-$(LIBWEBP_VERSION)
LIBSHARPYUV_ST := $(LIBWEBP_DIR)/build_st/libsharpyuv.a
LIBSHARPYUV_MT := $(LIBWEBP_DIR)/build_mt/libsharpyuv.a
export LIBSHARPYUV := $(LIBWEBP_DIR)/build/libsharpyuv.a

OUT_ENC_JS = enc/avif_enc.js
OUT_NODE_ENC_JS = node_modules/build/version/enc/avif_node_enc.js
OUT_ENC_MT_JS = enc/avif_enc_mt.js
OUT_NODE_ENC_MT_JS = enc/avif_node_enc_mt.js
OUT_DEC_JS = dec/avif_dec.js
OUT_NODE_DEC_JS = dec/avif_node_dec.js

OUT_ENC_CPP = enc/avif_enc.cpp
OUT_DEC_CPP = dec/avif_dec.cpp
ENVIRONMENT = worker

HELPER_MAKEFLAGS := -f helper.Makefile

.PHONY: all clean

all: $(OUT_ENC_JS) $(OUT_DEC_JS) $(OUT_ENC_MT_JS) $(OUT_NODE_ENC_JS)

# ST-Encoding
$(OUT_ENC_JS): $(OUT_ENC_CPP) $(CODEC_DIR)/CMakeLists.txt $(LIBAOM_DIR)/CMakeLists.txt $(LIBSHARPYUV_ST) Makefile helper.Makefile
	mkdir -p $(LIBWEBP_DIR)/build && cp $(LIBSHARPYUV_ST) $(LIBSHARPYUV)
	$(MAKE) \
		$(HELPER_MAKEFLAGS) \
		OUT_JS=$@ \
		OUT_CPP=$< \
		LIBAOM_FLAGS="\
			-DCONFIG_AV1_DECODER=0 \
			-DCONFIG_MULTITHREAD=0 \
			-DCONFIG_AV1_HIGHBITDEPTH=0 \
		" \
		ENVIRONMENT=$(ENVIRONMENT) \
		LIBAVIF_FLAGS="-DAVIF_CODEC_AOM_DECODE=0" \
		OUT_FLAGS="-s SUPPORT_LONGJMP=emscripten"

$(OUT_NODE_ENC_JS): $(OUT_ENC_JS) Makefile helper.Makefile
	mkdir -p $(@D)
	$(MAKE) \
		$(HELPER_MAKEFLAGS) \
		OUT_BUILD_DIR=$(BUILD_DIR)/enc/avif_enc \
		OUT_JS=$@ \
		OUT_CPP=$(OUT_ENC_CPP) \
		LIBAOM_FLAGS="\
			-DCONFIG_AV1_DECODER=0 \
			-DCONFIG_MULTITHREAD=0 \
			-DCONFIG_AV1_HIGHBITDEPTH=0 \
		" \
		ENVIRONMENT=node \
		LIBAVIF_FLAGS="-DAVIF_CODEC_AOM_DECODE=0" \
		OUT_FLAGS="-s SUPPORT_LONGJMP=emscripten"

# MT-Encoding
# We need to run the ST and MT tasks sequentially to avoid conflicts with the copy of libsharpyuv in the build directory
$(OUT_ENC_MT_JS): $(OUT_ENC_CPP) $(CODEC_DIR)/CMakeLists.txt $(LIBAOM_DIR)/CMakeLists.txt $(LIBSHARPYUV_MT) Makefile helper.Makefile | $(OUT_ENC_JS)
	mkdir -p $(LIBWEBP_DIR)/build && cp $(LIBSHARPYUV_MT) $(LIBSHARPYUV)
	$(MAKE) \
		$(HELPER_MAKEFLAGS) \
		OUT_JS=$@ \
		OUT_CPP=$< \
		LIBAOM_FLAGS="\
			-DCONFIG_AV1_DECODER=0 \
			-DCONFIG_AV1_HIGHBITDEPTH=0 \
		" \
		ENVIRONMENT=$(ENVIRONMENT) \
		LIBAVIF_FLAGS="-DAVIF_CODEC_AOM_DECODE=0" \
		AVIF_THREAD_FLAGS="-pthread" \
		OUT_FLAGS="-pthread -s SUPPORT_LONGJMP=emscripten"

# Decoding
$(OUT_DEC_JS): $(OUT_DEC_CPP) $(CODEC_DIR)/CMakeLists.txt $(LIBAOM_DIR)/CMakeLists.txt Makefile helper.Makefile
	$(MAKE) \
		$(HELPER_MAKEFLAGS) \
		OUT_JS=$@ \
		OUT_CPP=$< \
		LIBAOM_FLAGS="\
			-DCONFIG_AV1_ENCODER=0 \
			-DCONFIG_MULTITHREAD=0 \
		" \
		ENVIRONMENT=$(ENVIRONMENT) \
		LIBAVIF_FLAGS="-DAVIF_CODEC_AOM_ENCODE=0" \
		OUT_FLAGS="-s SUPPORT_LONGJMP=emscripten"

# LIBAOM EXTRACTION SECTION

# Download the libaom tarball
$(LIBAOM_PACKAGE):
	mkdir -p $(@D)
	curl -sL $(LIBAOM_URL) -o $@

$(LIBAOM_DIR)/CMakeLists.txt: $(LIBAOM_SOURCE_STAMP)
	touch $@

$(LIBAOM_SOURCE_STAMP): $(LIBAOM_PACKAGE)
	$(RM) -r $(LIBAOM_DIR)
	mkdir -p $(LIBAOM_DIR)
	tar xzm -C $(LIBAOM_DIR) -f $(LIBAOM_PACKAGE)
	touch $@

# LIBAVIF EXTRACTION SECTION

# Download the libavif tarball
$(LIBAVIF_PACKAGE):
	mkdir -p $(@D)
	curl -sL $(LIBAVIF_URL) -o $@

$(CODEC_DIR)/CMakeLists.txt: $(LIBAVIF_SOURCE_STAMP)
	touch $@

$(LIBAVIF_SOURCE_STAMP): $(LIBAVIF_PACKAGE)
	$(RM) -r $(CODEC_DIR)
	mkdir -p $(CODEC_DIR)
	tar xzm --strip 1 -C $(CODEC_DIR) -f $(LIBAVIF_PACKAGE)
	touch $@

# Create libavif/ext/libwebp
$(LIBWEBP_DIR)/CMakeLists.txt: $(LIBWEBP_SOURCE_STAMP)
	touch $@

$(LIBWEBP_SOURCE_STAMP): $(CODEC_DIR)/CMakeLists.txt
	$(RM) -r $(LIBWEBP_DIR)
	mkdir -p $(LIBWEBP_DIR)
	curl -sL $(LIBWEBP_URL_WITH_SHARPYUV) | tar xzm -C $(LIBWEBP_DIR)
	touch $@

# Make libsharpyuv.a for ST-Encoding
$(LIBSHARPYUV_ST): $(LIBWEBP_DIR)/CMakeLists.txt
	mkdir -p $(@D)
	emcmake cmake \
		-DWEBP_USE_THREAD=OFF \
		-DWEBP_BUILD_ANIM_UTILS=OFF \
		-DWEBP_BUILD_CWEBP=OFF \
		-DWEBP_BUILD_DWEBP=OFF \
		-DWEBP_BUILD_GIF2WEBP=OFF \
		-DWEBP_BUILD_IMG2WEBP=OFF \
		-DWEBP_BUILD_VWEBP=OFF \
		-DWEBP_BUILD_WEBPINFO=OFF \
		-DWEBP_BUILD_LIBWEBPMUX=OFF \
		-DWEBP_BUILD_WEBPMUX=OFF \
		-DWEBP_BUILD_EXTRAS=OFF \
		-DBUILD_SHARED_LIBS=OFF \
		-DCMAKE_BUILD_TYPE=Release \
		-S $(LIBWEBP_DIR) \
		-B $(@D)
	$(MAKE) -C $(@D) sharpyuv

# Make libsharpyuv.a for MT-Encoding
$(LIBSHARPYUV_MT): $(LIBWEBP_DIR)/CMakeLists.txt
	mkdir -p $(@D)
	emcmake cmake \
		-DWEBP_BUILD_ANIM_UTILS=OFF \
		-DWEBP_BUILD_CWEBP=OFF \
		-DWEBP_BUILD_DWEBP=OFF \
		-DWEBP_BUILD_GIF2WEBP=OFF \
		-DWEBP_BUILD_IMG2WEBP=OFF \
		-DWEBP_BUILD_VWEBP=OFF \
		-DWEBP_BUILD_WEBPINFO=OFF \
		-DWEBP_BUILD_LIBWEBPMUX=OFF \
		-DWEBP_BUILD_WEBPMUX=OFF \
		-DWEBP_BUILD_EXTRAS=OFF \
		-DBUILD_SHARED_LIBS=OFF \
		-DCMAKE_BUILD_TYPE=Release \
		-S $(LIBWEBP_DIR) \
		-B $(@D)
	$(MAKE) -C $(@D) sharpyuv

clean:
	$(RM) $(OUT_ENC_JS) $(OUT_ENC_MT_JS) $(OUT_DEC_JS)
	$(RM) $(OUT_ENC_JS:.js=.wasm) $(OUT_ENC_MT_JS:.js=.wasm) $(OUT_DEC_JS:.js=.wasm)
	$(RM) $(OUT_ENC_JS:.js=.worker.js) $(OUT_ENC_MT_JS:.js=.worker.js) $(OUT_DEC_JS:.js=.worker.js)
	$(RM) -r $(BUILD_DIR)
