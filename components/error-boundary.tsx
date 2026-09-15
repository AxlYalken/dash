"use client";

import { Component, type ReactNode } from "react";
import { FeedbackState } from "./dashboard/feedback-state";

export class ErrorBoundary extends Component<{ children: ReactNode; name?: string; resetKey?: unknown }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: Readonly<{ children: ReactNode; name?: string; resetKey?: unknown }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? <FeedbackState title={this.props.name ? `Не удалось показать ${this.props.name}` : "Не удалось показать этот блок"} message="Возникла ошибка интерфейса. Остальные разделы доступны — попробуйте открыть этот блок снова." onRetry={() => this.setState({ failed: false })} /> : this.props.children;
  }
}
