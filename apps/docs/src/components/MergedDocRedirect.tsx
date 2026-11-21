import { Redirect, useLocation } from "@docusaurus/router";
import useBrokenLinks from "@docusaurus/useBrokenLinks";

export default function MergedDocRedirect({
  redirect: { to, anchors },
}: {
  redirect: { to: string; anchors: string[] };
}) {
  const { hash } = useLocation();
  const { collectAnchor } = useBrokenLinks();
  anchors.forEach(collectAnchor);

  return <Redirect to={to.includes("#") ? to : to + hash} />;
}
