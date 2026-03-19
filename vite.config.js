import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8080
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        casting: resolve(__dirname, "casting.html"),
        talents: resolve(__dirname, "talents.html"),
        projects: resolve(__dirname, "projects.html"),
        contact: resolve(__dirname, "contact.html"),
        project: resolve(__dirname, "project.html"),
        admin: resolve(__dirname, "admin.html")
      }
    }
  }
});
