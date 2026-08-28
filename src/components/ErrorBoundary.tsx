import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 text-center" dir="rtl">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl max-w-lg shadow-xl">
            <h2 className="text-2xl font-bold mb-3 text-red-600 dark:text-red-400">حدث خطأ غير متوقع</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm">
              واجه التطبيق مشكلة أثناء العرض. يرجى محاولة تحديث الصفحة.
            </p>
            {this.state.error && (
              <pre className="bg-zinc-100 dark:bg-zinc-800/60 text-xs p-3 rounded-lg text-left overflow-auto max-h-32 mb-6 font-mono text-zinc-700 dark:text-zinc-300">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
