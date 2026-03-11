/**
 * NavigationHistory — breadcrumb back-navigation stack.
 *
 * When a user clicks a breadcrumb ancestor, the current element is pushed
 * onto the stack. Clicking close pops back through history before actually
 * dismissing the panel.
 */

export class NavigationHistory {
  private stack: Element[] = [];

  push(el: Element): void {
    // Don't push duplicate consecutive elements
    if (this.stack.length > 0 && this.stack[this.stack.length - 1] === el) return;
    this.stack.push(el);
  }

  goBack(): Element | null {
    return this.stack.pop() ?? null;
  }

  canGoBack(): boolean {
    return this.stack.length > 0;
  }

  clear(): void {
    this.stack = [];
  }
}

/**
 * Compute the maximum height for the panel given its Y position.
 * Ensures the panel never extends below the viewport.
 * @param posY - panel's top offset in pixels
 * @param viewportHeight - window.innerHeight
 * @param margin - bottom margin (default 16px)
 * @returns max height in pixels (minimum 200px)
 */
export function computePanelMaxHeight(posY: number, viewportHeight: number, margin: number = 16): number {
  return Math.max(200, viewportHeight - posY - margin);
}
