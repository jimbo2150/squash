CODEC_URL = https://github.com/libjxl/libjxl.git
CODEC_VERSION = v0.12.0
CODEC_DIR = node_modules/jxl
CODEC_SOURCE_STAMP := $(CODEC_DIR)/.source-$(CODEC_VERSION)
CODEC_BUILD_ROOT := $(CODEC_DIR)/build
CODEC_ST_BUILD_DIR := $(CODEC_BUILD_ROOT)/st
CODEC_MT_BUILD_DIR := $(CODEC_BUILD_ROOT)/mt
CODEC_MT_SIMD_BUILD_DIR := $(CODEC_BUILD_ROOT)/mt-simd
ENVIRONMENT = worker

OUT_JS = enc/jxl_enc.js enc/jxl_enc_mt.js enc/jxl_enc_mt_simd.js dec/jxl_dec.js enc/jxl_node_enc.js dec/jxl_node_dec.js
OUT_WASM = $(OUT_JS:.js=.wasm)
OUT_WORKER = $(OUT_JS:.js=.worker.js)

.PHONY: all clean

all: $(OUT_JS)

# Define dependencies for all variations of build artifacts.
$(filter enc/%,$(OUT_JS)): enc/jxl_enc.cpp
$(filter dec/%,$(OUT_JS)): dec/jxl_dec.cpp

enc/jxl_node_enc.js dec/jxl_node_dec.js: ENVIRONMENT = node

enc/jxl_enc.js enc/jxl_node_enc.js dec/jxl_dec.js dec/jxl_node_dec.js: CODEC_BUILD_DIR := $(CODEC_ST_BUILD_DIR)
enc/jxl_enc_mt.js: CODEC_BUILD_DIR := $(CODEC_MT_BUILD_DIR)
enc/jxl_enc_mt_simd.js: CODEC_BUILD_DIR := $(CODEC_MT_SIMD_BUILD_DIR)

enc/jxl_node_enc.js dec/jxl_node_dec.js enc/jxl_enc.js dec/jxl_dec.js: $(CODEC_ST_BUILD_DIR)/lib/libjxl.a $(CODEC_ST_BUILD_DIR)/lib/libjxl_cms.a
enc/jxl_enc_mt.js: $(CODEC_MT_BUILD_DIR)/lib/libjxl.a $(CODEC_MT_BUILD_DIR)/lib/libjxl_cms.a $(CODEC_MT_BUILD_DIR)/lib/libjxl_threads.a
enc/jxl_enc_mt_simd.js: $(CODEC_MT_SIMD_BUILD_DIR)/lib/libjxl.a $(CODEC_MT_SIMD_BUILD_DIR)/lib/libjxl_cms.a $(CODEC_MT_SIMD_BUILD_DIR)/lib/libjxl_threads.a

# Disable errors on deprecated SIMD intrinsics.
# JPEG-XL & Highway need to catch up, once they do, we can remove this suppression.
export CXXFLAGS += -Wno-deprecated-declarations

# Compile multithreaded wrappers with -pthread.
enc/jxl_enc_mt.js enc/jxl_enc_mt_simd.js: CXXFLAGS+=-pthread

$(OUT_JS):
	$(CXX) \
		$(CXXFLAGS) \
		$(LDFLAGS) \
		-I $(CODEC_DIR) \
		-I $(CODEC_DIR)/lib \
		-I $(CODEC_DIR)/lib/include \
		-I $(CODEC_BUILD_DIR)/lib/include \
		-I $(CODEC_DIR)/third_party/highway \
		-I $(CODEC_DIR)/third_party/skcms \
		--bind \
		-s ENVIRONMENT=$(ENVIRONMENT) \
		-s EXPORT_ES6=1 \
		-o $@ \
		$+ \
		$(CODEC_BUILD_DIR)/third_party/brotli/libbrotlidec.a \
		$(CODEC_BUILD_DIR)/third_party/brotli/libbrotlienc.a \
		$(CODEC_BUILD_DIR)/third_party/brotli/libbrotlicommon.a \
		$(CODEC_BUILD_DIR)/third_party/highway/libhwy.a

%/lib/libjxl.a: %/Makefile
	$(MAKE) -C $(<D) jxl

%/lib/libjxl_cms.a: %/Makefile
	$(MAKE) -C $(<D) jxl_cms

%/lib/libjxl_threads.a: %/Makefile
	$(MAKE) -C $(<D) jxl_threads

$(CODEC_ST_BUILD_DIR)/Makefile: CMAKE_FLAGS += -DJPEGXL_ENABLE_WASM_THREADS=OFF
$(CODEC_MT_BUILD_DIR)/Makefile: CMAKE_FLAGS += -DJPEGXL_ENABLE_WASM_THREADS=ON
$(CODEC_MT_SIMD_BUILD_DIR)/Makefile: CMAKE_FLAGS += -DJPEGXL_ENABLE_WASM_THREADS=ON

# Enable SIMD on a SIMD build.
$(CODEC_MT_SIMD_BUILD_DIR)/Makefile: CXXFLAGS += -msimd128

%/Makefile: $(CODEC_DIR)/CMakeLists.txt $(CODEC_SOURCE_STAMP)
	emcmake cmake \
	$(CMAKE_FLAGS) \
	-DBUILD_SHARED_LIBS=0 \
	-DJPEGXL_ENABLE_BENCHMARK=0 \
	-DJPEGXL_ENABLE_EXAMPLES=0 \
	-DBUILD_TESTING=0 \
	-DCMAKE_CROSSCOMPILING_EMULATOR=node \
	-B $(@D) \
	$(<D)

$(CODEC_DIR)/CMakeLists.txt: $(CODEC_SOURCE_STAMP)
	touch $@

$(CODEC_SOURCE_STAMP):
	$(RM) -r $(CODEC_DIR)
	git init $(CODEC_DIR)
	git -C $(CODEC_DIR) fetch $(CODEC_URL) $(CODEC_VERSION) --depth 1
	git -C $(CODEC_DIR) checkout FETCH_HEAD
	git -C $(CODEC_DIR) submodule update --init --depth 1 --recursive --jobs `nproc`
	touch $@

clean:
	$(RM) $(OUT_JS) $(OUT_WASM) $(OUT_WORKER)
	$(RM) -r $(CODEC_BUILD_ROOT)
