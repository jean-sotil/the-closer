import { useState, useRef, useEffect } from "react";
import { ImageOff } from "lucide-react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string | undefined;
  placeholderClassName?: string | undefined;
  onLoad?: (() => void) | undefined;
  onError?: (() => void) | undefined;
}

/**
 * Lazy-loaded image component with IntersectionObserver
 * Only loads images when they enter the viewport
 */
export function LazyImage({
  src,
  alt,
  className = "",
  placeholderClassName = "",
  onLoad,
  onError,
}: LazyImageProps): React.ReactElement {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px", // Start loading 50px before entering viewport
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="w-8 h-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative" ref={imgRef}>
      {/* Placeholder */}
      {!isLoaded && (
        <div
          className={`absolute inset-0 bg-gray-200 animate-pulse ${placeholderClassName}`}
        />
      )}

      {/* Actual image */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}

/**
 * Responsive image with srcset support
 */
interface ResponsiveImageProps extends LazyImageProps {
  srcSet?: string | undefined;
  sizes?: string | undefined;
}

export function ResponsiveImage({
  src,
  srcSet,
  sizes,
  alt,
  className = "",
  placeholderClassName = "",
  onLoad,
  onError,
}: ResponsiveImageProps): React.ReactElement {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "100px",
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="w-8 h-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative" ref={imgRef}>
      {!isLoaded && (
        <div
          className={`absolute inset-0 bg-gray-200 animate-pulse ${placeholderClassName}`}
        />
      )}

      {isInView && (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          className={`transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}

/**
 * Generate thumbnail URL with size parameter
 * Works with image hosting services that support URL-based resizing
 */
export function getThumbnailUrl(
  originalUrl: string,
  width: number,
  height?: number | undefined
): string {
  // Check if URL already has query params
  const separator = originalUrl.includes("?") ? "&" : "?";

  // Common patterns for image services
  // Supabase Storage
  if (originalUrl.includes("supabase")) {
    return `${originalUrl}${separator}width=${width}${height ? `&height=${height}` : ""}`;
  }

  // Cloudinary
  if (originalUrl.includes("cloudinary")) {
    const parts = originalUrl.split("/upload/");
    if (parts.length === 2) {
      return `${parts[0]}/upload/w_${width}${height ? `,h_${height}` : ""},c_limit/${parts[1]}`;
    }
  }

  // Imgix
  if (originalUrl.includes("imgix")) {
    return `${originalUrl}${separator}w=${width}${height ? `&h=${height}` : ""}&fit=max`;
  }

  // Default: return original URL
  return originalUrl;
}
