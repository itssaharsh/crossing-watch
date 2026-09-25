import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crossing Watch",
    short_name: "Crossings",
    description: "Cross, wait or reroute at Juja's flood-prone crossings.",
    start_url: "/app",
    display: "standalone",
    background_color: "#E3E7E7",
    theme_color: "#E3E7E7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
