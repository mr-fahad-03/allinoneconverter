import { tools, getToolBySlug, toolSlugAliases } from "@/lib/tools-data";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return [
    ...tools.map((t) => ({ slug: t.slug })),
    ...Object.keys(toolSlugAliases).map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return {};
  return {
    title: `${tool.name} — Free Online Tool`,
    description: tool.description,
    openGraph: {
      title: `${tool.name} — 🫶iDocs`,
      description: tool.description,
    },
  };
}

export default function ToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
