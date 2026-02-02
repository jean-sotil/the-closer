import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  Image,
  Video,
  FileText,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import type { EvidenceItem } from "@the-closer/shared";
import type { EvidenceGalleryProps, LucideIcon } from "./types";

/**
 * Get icon for evidence type
 */
function getEvidenceIcon(type: EvidenceItem["type"]): LucideIcon {
  switch (type) {
    case "screenshot":
      return Image;
    case "video":
      return Video;
    case "report":
    case "trace":
    default:
      return FileText;
  }
}

/**
 * Evidence thumbnail card
 */
interface EvidenceThumbnailProps {
  item: EvidenceItem;
  onClick: () => void;
}

function EvidenceThumbnail({
  item,
  onClick,
}: EvidenceThumbnailProps): React.ReactElement {
  const Icon = getEvidenceIcon(item.type);
  const isMedia = item.type === "screenshot" || item.type === "video";

  return (
    <button
      onClick={onClick}
      className="group relative aspect-video bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all"
    >
      {isMedia ? (
        <img
          src={item.url}
          alt={item.description ?? `${item.type} evidence`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to icon if image fails to load
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}

      {/* Overlay with icon and type */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-0 group-hover:bg-opacity-50 transition-all">
        <Icon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Type badge */}
      <span className="absolute top-2 left-2 px-2 py-0.5 bg-black bg-opacity-60 text-white text-xs rounded capitalize">
        {item.type}
      </span>

      {/* Expand icon */}
      <span className="absolute top-2 right-2 p-1 bg-black bg-opacity-60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
        <Maximize2 className="w-3 h-3" />
      </span>

      {/* Description */}
      {item.description && (
        <span className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black bg-opacity-60 text-white text-xs truncate">
          {item.description}
        </span>
      )}
    </button>
  );
}

/**
 * Full-size modal viewer
 */
interface EvidenceModalProps {
  items: EvidenceItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

function EvidenceModal({
  items,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: EvidenceModalProps): React.ReactElement {
  const item = items[currentIndex];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < items.length - 1;

  const handleDownload = () => {
    if (!item) return;
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.description ?? `evidence-${item.type}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!item) return <></>;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-90" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded capitalize">
                      {item.type}
                    </span>
                    <span className="text-sm text-gray-600">
                      {currentIndex + 1} of {items.length}
                    </span>
                    {item.description && (
                      <span className="text-sm text-gray-900 font-medium ml-2">
                        {item.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownload}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={onClose}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="relative bg-gray-100">
                  {/* Navigation buttons */}
                  {canGoPrev && (
                    <button
                      onClick={() => onNavigate(currentIndex - 1)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 z-10"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}
                  {canGoNext && (
                    <button
                      onClick={() => onNavigate(currentIndex + 1)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 z-10"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}

                  {/* Media content */}
                  <div className="flex items-center justify-center min-h-[400px] max-h-[70vh] p-4">
                    {item.type === "video" ? (
                      <video
                        src={item.url}
                        controls
                        className="max-w-full max-h-full rounded"
                        autoPlay
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : item.type === "screenshot" ? (
                      <img
                        src={item.url}
                        alt={item.description ?? "Screenshot evidence"}
                        className="max-w-full max-h-full object-contain rounded"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-4 text-gray-500">
                        <FileText className="w-16 h-16" />
                        <p>{item.type} file</p>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary"
                        >
                          Open in new tab
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Thumbnails strip */}
                {items.length > 1 && (
                  <div className="p-3 bg-gray-50 border-t border-gray-200 overflow-x-auto">
                    <div className="flex gap-2">
                      {items.map((thumb, idx) => (
                        <button
                          key={idx}
                          onClick={() => onNavigate(idx)}
                          className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden ${
                            idx === currentIndex
                              ? "ring-2 ring-primary-500"
                              : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          {thumb.type === "screenshot" || thumb.type === "video" ? (
                            <img
                              src={thumb.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <FileText className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

/**
 * Evidence gallery component with modal viewer
 */
export function EvidenceGallery({
  items,
}: EvidenceGalleryProps): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleItemClick = (index: number) => {
    setCurrentIndex(index);
    setModalOpen(true);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Image className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="font-medium text-gray-900">No evidence collected</p>
        <p className="text-sm">Run an audit to capture screenshots and recordings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Image className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Evidence Gallery</h3>
        <span className="text-sm text-gray-500">({items.length} items)</span>
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item, idx) => (
          <EvidenceThumbnail
            key={idx}
            item={item}
            onClick={() => handleItemClick(idx)}
          />
        ))}
      </div>

      {/* Modal viewer */}
      <EvidenceModal
        items={items}
        currentIndex={currentIndex}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onNavigate={setCurrentIndex}
      />
    </div>
  );
}
