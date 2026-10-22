"use client";

import { useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { useDialog } from "@/lib/useDialog";
import { useMediaQuery } from "@/lib/useMediaQuery";

/**
 * A bottom sheet on phones (drag the handle down to dismiss) and a side drawer
 * or centred dialog on larger screens. Content scrolls inside; the page stays put.
 */
export function Sheet({
  open,
  onClose,
  title,
  titleId,
  description,
  closeLabel,
  variant = "drawer",
  header,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  titleId: string;
  description?: string;
  closeLabel: string;
  variant?: "drawer" | "dialog";
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const desktop = useMediaQuery("(min-width: 768px)");
  const drag = useDragControls();
  useDialog(open, onClose, panelRef);

  const from = !desktop
    ? { y: "100%" }
    : variant === "drawer"
      ? { x: "106%" }
      : { opacity: 0, scale: 0.96, y: 24 };

  return (
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 z-[100] flex ${
            desktop ? (variant === "drawer" ? "justify-end p-3" : "items-center justify-center p-6") : "items-end"
          }`}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-forest/45 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? `${titleId}-description` : undefined}
            tabIndex={-1}
            initial={from}
            animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            exit={{ ...from, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: "spring", damping: 32, stiffness: 330 }}
            drag={desktop ? false : "y"}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 650) onClose();
            }}
            className={`relative flex w-full flex-col overflow-hidden bg-surface text-cream shadow-[0_-20px_80px_rgba(7,26,18,.28)] outline-none ${
              desktop
                ? variant === "drawer"
                  ? "h-full max-w-[460px] rounded-[1.75rem]"
                  : "max-h-[88vh] max-w-[540px] rounded-[2rem]"
                : "max-h-[92svh] rounded-t-[1.75rem] pb-[env(safe-area-inset-bottom)]"
            }`}
          >
            {!desktop && (
              <div
                onPointerDown={(e) => drag.start(e)}
                className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                aria-hidden
              >
                <span className="h-1.5 w-11 rounded-full bg-line" />
              </div>
            )}
            <div className={`flex shrink-0 items-start justify-between gap-4 px-6 ${desktop ? "pt-6" : "pt-1"}`}>
              <div className="min-w-0">
                {header}
                <h2 id={titleId} className="font-display text-2xl font-semibold leading-tight">{title}</h2>
                {description && <p id={`${titleId}-description`} className="sr-only">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-fog transition hover:bg-base-2 hover:text-cream"
              >
                <X size={20} />
              </button>
            </div>
            <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-4">
              {children}
            </div>
            {footer && <div className="shrink-0 border-t border-line bg-surface/95 px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
