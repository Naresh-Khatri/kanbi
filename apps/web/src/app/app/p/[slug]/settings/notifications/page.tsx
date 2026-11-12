import { NotificationSettings } from "../_components/settings-pages";

export default async function ProjectNotificationSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <NotificationSettings slug={slug} />;
}
