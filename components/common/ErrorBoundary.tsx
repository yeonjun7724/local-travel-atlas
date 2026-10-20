"use client";

import { Component, type ReactNode } from "react";

interface Props {
  fallback: (reset: () => void) => ReactNode;
  children: ReactNode;
}

/** 지도 같은 일부 영역이 오류로 죽어도 나머지 화면(목록·코스)은 계속 쓸 수 있게 격리합니다. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}
