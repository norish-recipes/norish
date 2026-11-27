import { redirect } from "next/navigation";
import { contentHref, DEFAULT_CONTENT_LIST } from "@/features/content/content-lists";

export default function ContentSettingsPage() {
  redirect(contentHref(DEFAULT_CONTENT_LIST));
}
