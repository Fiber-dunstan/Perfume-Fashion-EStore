
import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "perfume-fashion-store",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-29",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      DB: bindings.d1({ name: "perfume-fashion-store-db", id: "f1c51d12-350d-474e-988b-8192c3a826c4" }),
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      CLOUDINARY_CLOUD_NAME: bindings.secret(),
      CLOUDINARY_API_KEY: bindings.secret(),
      CLOUDINARY_API_SECRET: bindings.secret(),
    },
  }),
});

