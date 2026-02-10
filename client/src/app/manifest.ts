import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "🫶iDocs — Free Online PDF & Document Tools",
    short_name: "iDocs",
    description:
      "Merge, split, compress, convert, edit, and secure your PDF files online — all free. No installation required.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#6366f1",
    orientation: "portrait-primary",
    scope: "/",
    lang: "en",
    categories: ["utilities", "productivity", "business"],
    icons: [
      {
        src: "/vercel.svg",
        sizes: "96x96",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    screenshots: [],
    shortcuts: [],
    related_applications: [],
    prefer_related_applications: false,
  };
}
