/** Move through visible menu controls with wraparound, shared by keys and gamepads. */
export function menuControls(scope: ParentNode) {
  return Array.from(scope.querySelectorAll<HTMLElement>("button,input,select"))
    .filter(element => element.getClientRects().length > 0 && !element.hasAttribute("disabled"));
}
export function focusMenuControl(scope: ParentNode, direction: number) {
  const controls = menuControls(scope);
  if (!controls.length) return;
  const index = controls.indexOf(document.activeElement as HTMLElement);
  const next = index < 0 ? (direction > 0 ? 0 : controls.length - 1)
    : (index + direction + controls.length) % controls.length;
  controls[next].focus();
}
