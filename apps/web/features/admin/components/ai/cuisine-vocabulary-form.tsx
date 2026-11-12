"use client";

import { useState } from "react";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { Input, Modal, ScrollShadow, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CuisineRefusal } from "@norish/shared-react/admin";
import { useCuisineWrites } from "@norish/shared-react/admin";
import { useCuisinesQuery } from "@norish/shared-react/config";

/**
 * Cuisine vocabulary administration.
 *
 * A rename is one row and every recipe follows it; a delete is a silent cascade
 * with no usage count, so the only confirmation is the ordinary one.
 */
export default function CuisineVocabularyForm() {
  const t = useTranslations("settings.admin.cuisineVocabulary");
  const tActions = useTranslations("common.actions");
  const { cuisines, isLoading } = useCuisinesQuery();
  const { create, rename, remove, isPending } = useCuisineWrites();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<CuisineRefusal | null>(null);

  // Shows why a write failed, or runs `onDone` once it went through.
  const run = async (write: () => Promise<CuisineRefusal | null>, onDone: () => void) => {
    setError(null);
    const refusal = await write();

    if (refusal) setError(refusal);
    else onDone();
  };

  const handleAdd = () => {
    const name = newName.trim();

    if (!name) return;

    void run(
      () => create(name),
      () => setNewName("")
    );
  };

  const handleRename = () => {
    const name = editingName.trim();

    if (!editingId || !name) return;

    void run(
      () => rename(editingId, name),
      () => setEditingId(null)
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-base">{t("description")}</p>

      <div className="flex items-end gap-2">
        <TextField
          aria-label={t("addLabel")}
          className="flex-1"
          value={newName}
          onChange={setNewName}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAdd();
          }}
        >
          <Input placeholder={t("namePlaceholder")} variant="secondary" />
        </TextField>
        <ActionButton
          action="add"
          isDisabled={newName.trim().length === 0 || isPending}
          onPress={handleAdd}
        >
          {tActions("add")}
        </ActionButton>
      </div>

      {error && <p className="text-danger text-sm">{t(error)}</p>}

      {!isLoading && cuisines.length === 0 && <p className="text-muted text-base">{t("empty")}</p>}

      {/* The vocabulary grows without bound, so the list scrolls inside a fixed
          height rather than pushing the add field off the top of the card. */}
      <ScrollShadow className="max-h-80" size={24}>
        <ul className="divide-border divide-y">
          {cuisines.map((cuisine) =>
            editingId === cuisine.id ? (
              <li key={cuisine.id} className="flex items-center gap-2 py-2">
                <TextField
                  aria-label={t("renameLabel", { name: cuisine.name })}
                  className="flex-1"
                  value={editingName}
                  onChange={setEditingName}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleRename();
                    if (event.key === "Escape") setEditingId(null);
                  }}
                >
                  <Input variant="secondary" />
                </TextField>
                <IconActionButton
                  action="save"
                  isDisabled={editingName.trim().length === 0 || isPending}
                  label={tActions("save")}
                  size="sm"
                  onPress={handleRename}
                />
                <IconActionButton
                  action="cancel"
                  label={tActions("cancel")}
                  size="sm"
                  onPress={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={cuisine.id} className="flex items-center justify-between gap-2 py-2">
                <span className="text-base">{cuisine.name}</span>
                <div className="flex items-center gap-1">
                  <IconActionButton
                    action="edit"
                    label={t("renameLabel", { name: cuisine.name })}
                    size="sm"
                    onPress={() => {
                      setError(null);
                      setEditingId(cuisine.id);
                      setEditingName(cuisine.name);
                    }}
                  />
                  <IconActionButton
                    action="delete"
                    label={t("deleteLabel", { name: cuisine.name })}
                    size="sm"
                    onPress={() => setPendingDelete({ id: cuisine.id, name: cuisine.name })}
                  />
                </div>
              </li>
            )
          )}
        </ul>
      </ScrollShadow>

      <Modal.Backdrop
        className="z-[1099]"
        isOpen={pendingDelete !== null}
        onOpenChange={() => setPendingDelete(null)}
      >
        <Modal.Container className="z-[1100]">
          <Modal.Dialog>
            {({ close }) => (
              <>
                <Modal.Header className="text-danger">{tActions("delete")}</Modal.Header>
                <Modal.Body>
                  <p>{t("deleteConfirm", { name: pendingDelete?.name ?? "" })}</p>
                </Modal.Body>
                <Modal.Footer>
                  <ActionButtonGroup>
                    <ActionButton action="cancel" onPress={close}>
                      {tActions("cancel")}
                    </ActionButton>
                    <ActionButton
                      action="delete"
                      variant="danger"
                      onPress={() => {
                        const target = pendingDelete;

                        if (!target) return;

                        void run(
                          () => remove(target.id),
                          () => setPendingDelete(null)
                        );
                      }}
                    >
                      {tActions("delete")}
                    </ActionButton>
                  </ActionButtonGroup>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
