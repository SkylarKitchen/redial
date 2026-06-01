/**
 * NavigationHistory — breadcrumb back-navigation stack.
 *
 * When a user clicks a breadcrumb ancestor, the current element is pushed
 * onto the stack. Clicking close pops back through history before actually
 * dismissing the panel.
 */

export class NavigationHistory {
  private stack: Element[] = [];

  /**
   * Push an element onto the history stack.
   * Consecutive duplicate entries are ignored.
   * @param el - the DOM element to record as the previous navigation target
   */
  push(el: Element): void {
    // Don't push duplicate consecutive elements
    if (this.stack.length > 0 && this.stack[this.stack.length - 1] === el) return;
    this.stack.push(el);
  }

  /**
   * Pop and return the most recently pushed element.
   * @returns the previous element, or `null` if the stack is empty
   */
  goBack(): Element | null {
    return this.stack.pop() ?? null;
  }

  /**
   * Whether there is at least one entry to navigate back to.
   * @returns `true` when the history stack is non-empty
   */
  canGoBack(): boolean {
    return this.stack.length > 0;
  }

  /**
   * Remove all entries from the history stack.
   */
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
