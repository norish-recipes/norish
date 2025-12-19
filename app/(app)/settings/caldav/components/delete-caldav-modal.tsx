"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
} from "@heroui/react";

interface DeleteCalDavModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteEvents: boolean) => Promise<void>;
}

export default function DeleteCalDavModal({ isOpen, onClose, onConfirm }: DeleteCalDavModalProps) {
  const [deleteEvents, setDeleteEvents] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm(deleteEvents);
      setDeleteEvents(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Delete CalDAV Configuration</ModalHeader>
        <ModalBody>
          <p className="text-default-600 text-base">
            Are you sure you want to delete your CalDAV configuration?
          </p>
          <div className="mt-4">
            <Switch isSelected={deleteEvents} onValueChange={setDeleteEvents}>
              <div>
                <p className="text-base font-medium">Delete synced events</p>
                <p className="text-default-500 text-xs">
                  Remove all events that were created in your CalDAV calendar
                </p>
              </div>
            </Switch>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="danger" isLoading={deleting} onPress={handleConfirm}>
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
