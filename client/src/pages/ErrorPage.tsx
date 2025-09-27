import { useRouteError, isRouteErrorResponse, Link } from "react-router";

export default function ErrorPage() {
  const error = useRouteError();
  
  let errorCode = "Unknown";
  let errorMessage = "Something went wrong";
  let errorDescription = "An unexpected error has occurred.";

  if (isRouteErrorResponse(error)) {
    errorCode = error.status.toString();
    errorMessage = error.statusText;
    
    switch (error.status) {
      case 404:
        errorDescription = "The page you're looking for doesn't exist. It might have been moved, deleted, or you entered the wrong URL.";
        break;
      case 403:
        errorDescription = "You don't have permission to access this resource.";
        break;
      case 500:
        errorDescription = "Internal server error. Please try again later.";
        break;
      case 503:
        errorDescription = "Service temporarily unavailable. Please try again later.";
        break;
      default:
        errorDescription = "An error occurred while processing your request.";
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorDescription = "A client-side error occurred. Please refresh the page and try again.";
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="text-center max-w-2xl mx-auto">
        {/* Error Code */}
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-red-500 mb-4">
            {errorCode}
          </h1>
          <h2 className="text-2xl font-semibold mb-2">
            {errorMessage}
          </h2>
        </div>

        {/* Error Description */}
        <div className="mb-8">
          <p className="text-lg text-muted-foreground leading-relaxed">
            {errorDescription}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to="/" 
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go Home
          </Link>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Refresh Page
          </button>
          <button 
            onClick={() => window.history.back()} 
            className="px-6 py-3 border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Go Back
          </button>
        </div>

        {/* Additional Info (Development Mode) */}
        {process.env.NODE_ENV === 'development' && error instanceof Error && (
          <details className="mt-8 text-left bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <summary className="cursor-pointer font-medium text-red-800 dark:text-red-200 mb-2">
              Debug Information (Development Only)
            </summary>
            <pre className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-all">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}