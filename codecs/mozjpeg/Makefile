CODEC_URL := https://github.com/mozilla/mozjpeg/archive/v4.1.1.tar.gz
CODEC_DIR := node_modules/mozjpeg
CODEC_BUILD_DIR := $(CODEC_DIR)/build
CODEC_OUT := $(CODEC_BUILD_DIR)/libjpeg.a $(CODEC_DIR)/rdswitch.o
ENVIRONMENT = worker

OUT_JS := enc/mozjpeg_enc.js enc/mozjpeg_node_enc.js dec/mozjpeg_node_dec.js
OUT_WASM := $(OUT_JS:.js=.wasm)

.PHONY: all clean

all: $(OUT_JS)

$(filter enc/%,$(OUT_JS)): enc/mozjpeg_enc.cpp
$(filter dec/%,$(OUT_JS)): dec/mozjpeg_dec.cpp

enc/mozjpeg_node_enc.js dec/mozjpeg_node_dec.js: ENVIRONMENT = node

%.js: $(CODEC_OUT)
	$(CXX) \
		-I $(CODEC_BUILD_DIR) \
		-I $(CODEC_DIR) \
		${CXXFLAGS} \
		${LDFLAGS} \
		--bind \
		-s ENVIRONMENT=$(ENVIRONMENT) \
		-s EXPORT_ES6=1 \
		-o $@ \
		$+

$(CODEC_BUILD_DIR)/libjpeg.a: $(CODEC_BUILD_DIR)/Makefile
	$(MAKE) -C $(CODEC_BUILD_DIR) jpeg-static

$(CODEC_DIR)/rdswitch.o: $(CODEC_DIR)/rdswitch.c $(CODEC_BUILD_DIR)/Makefile
	$(CC) -I $(CODEC_BUILD_DIR) -I $(CODEC_DIR) $(CFLAGS) -c $< -o $@

$(CODEC_BUILD_DIR)/Makefile: $(CODEC_DIR)/CMakeLists.txt
	emcmake cmake -S $(CODEC_DIR) -B $(CODEC_BUILD_DIR) \
		-DCMAKE_BUILD_TYPE=Release \
		-DCMAKE_C_FLAGS="$(CFLAGS)" \
		-DENABLE_SHARED=OFF \
		-DENABLE_STATIC=ON \
		-DWITH_TURBOJPEG=OFF \
		-DWITH_SIMD=OFF \
		-DWITH_ARITH_ENC=OFF \
		-DWITH_ARITH_DEC=OFF \
		-DWITH_MEM_SRCDST=ON \
		-DPNG_SUPPORTED=OFF \
		-DBUILD=squash

$(CODEC_DIR)/CMakeLists.txt $(CODEC_DIR)/rdswitch.c: $(CODEC_DIR)

$(CODEC_DIR):
	mkdir -p $@
	curl -sL $(CODEC_URL) | tar xz --strip 1 -C $@

clean:
	$(RM) $(OUT_JS) $(OUT_WASM) $(CODEC_DIR)/rdswitch.o
	$(RM) -r $(CODEC_BUILD_DIR)
