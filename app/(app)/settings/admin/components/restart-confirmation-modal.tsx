"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";

type RestartConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function RestartConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
}: RestartConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <ExclamationTriangleIcon className="text-warning h-5 w-5" />
          Restart Server
        </ModalHeader>
        <ModalBody>
          <p>Are you sure you want to restart the server?</p>
          <div className="bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800 mt-2 rounded-lg border p-4">
            <p className="text-warning-700 dark:text-warning-300 text-base font-medium">
              Important:
            </p>
            <ul className="text-warning-600 dark:text-warning-400 mt-2 list-inside list-disc space-y-1 text-base">
              <li>All active connections will be disconnected</li>
              <li>The server will be unavailable for a few seconds</li>
              <li>
                Ensure your deployment has{" "}
                <code className="bg-warning-100 dark:bg-warning-800 rounded px-1">
                  restart: always
                </code>{" "}
                configured, or the server will not come back online automatically
              </li>
            </ul>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button color="warning" onPress={onConfirm}>
            Restart Now
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
