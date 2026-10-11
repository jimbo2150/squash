export interface JXLModule extends EmscriptenWasm.Module {
  version(): number;
  decode(data: ArrayBuffer): ImageData | null;
}

declare var moduleFactory: EmscriptenWasm.ModuleFactory<JXLModule>;

export default moduleFactory;
