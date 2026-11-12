import { GeneralSettings } from "./_components/settings-pages";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <GeneralSettings slug={slug} />;
}
