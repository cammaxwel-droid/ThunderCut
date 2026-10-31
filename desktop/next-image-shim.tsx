import { forwardRef, ImgHTMLAttributes } from 'react';

type StaticImageSource = string | { src: string };

type DesktopImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: StaticImageSource;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
};

const DesktopImage = forwardRef<HTMLImageElement, DesktopImageProps>(function DesktopImage(
  {
    src,
    alt,
    fill = false,
    priority = false,
    quality,
    unoptimized,
    style,
    loading,
    ...imageProps
  },
  ref,
) {
  void quality;
  void unoptimized;
  const resolvedSource = typeof src === 'string' ? src : src.src;
  const fillStyle = fill
    ? { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', ...style }
    : style;

  return (
    // This is the desktop-only compatibility layer for Next's Image component.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...imageProps}
      ref={ref}
      src={resolvedSource}
      alt={alt}
      style={fillStyle}
      loading={priority ? 'eager' : loading}
    />
  );
});

export default DesktopImage;
