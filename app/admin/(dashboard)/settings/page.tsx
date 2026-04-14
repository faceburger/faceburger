import { getSettings } from "@/actions/settings";
import { SettingsClient } from "@/components/admin/SettingsClient";

export default async function SettingsPage() {
  const settings = await getSettings();
  return <SettingsClient settings={settings} />;
}
