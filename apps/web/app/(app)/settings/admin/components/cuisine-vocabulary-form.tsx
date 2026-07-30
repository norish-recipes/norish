"use client";

import { useCallback, useState } from "react";
import { useCuisinesQuery } from "@/hooks/config";
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button, Input, Modal, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useCuisineAdminMutations } from "../hooks/use-cuisine-admin-mutations";

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
  const { create, rename, remove, isPending } = useCuisineAdminMutations();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<unknown>, onDone: () => void) => {
    setError(null);

    try {
      await action();
      onDone();
    } catch (err) {
      const isConflict =
        typeof err === "object" && err !== null && "data" in err
          ? (err as { data?: { code?: string } }).data?.code === "CONFLICT"
          : false;

      setError(isConflict ? "duplicate" : "saveFailed");
    }
  }, []);

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
        <Button
          isDisabled={newName.trim().length === 0 || isPending}
          variant="primary"
          onPress={handleAdd}
        >
          <PlusIcon className="h-4 w-4" />
          {tActions("add")}
        </Button>
      </div>

      {error && (
        <p className="text-danger text-sm">
          {t(error === "duplicate" ? "duplicate" : "saveFailed")}
        </p>
      )}

      {!isLoading && cuisines.length === 0 && <p className="text-muted text-base">{t("empty")}</p>}

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
              <Button
                aria-label={tActions("save")}
                isDisabled={editingName.trim().length === 0 || isPending}
                variant="primary"
                onPress={handleRename}
              >
                <CheckIcon className="h-4 w-4" />
              </Button>
              <Button
                aria-label={tActions("cancel")}
                onPress={() => setEditingId(null)}
                variant="tertiary"
              >
                <XMarkIcon className="h-4 w-4" />
              </Button>
            </li>
          ) : (
            <li key={cuisine.id} className="flex items-center justify-between gap-2 py-2">
              <span className="text-base">{cuisine.name}</span>
              <div className="flex items-center gap-1">
                <Button
                  aria-label={t("renameLabel", { name: cuisine.name })}
                  onPress={() => {
                    setError(null);
                    setEditingId(cuisine.id);
                    setEditingName(cuisine.name);
                  }}
                  variant="tertiary"
                >
                  <PencilIcon className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={t("deleteLabel", { name: cuisine.name })}
                  onPress={() => setPendingDelete({ id: cuisine.id, name: cuisine.name })}
                  variant="tertiary"
                >
                  <TrashIcon className="text-danger h-4 w-4" />
                </Button>
              </div>
            </li>
          )
        )}
      </ul>

      <Modal.Backdrop isOpen={pendingDelete !== null} onOpenChange={() => setPendingDelete(null)}>
        <Modal.Container>
          <Modal.Dialog>
            {({ close }) => (
              <>
                <Modal.Header className="text-danger">{tActions("delete")}</Modal.Header>
                <Modal.Body>
                  <p>{t("deleteConfirm", { name: pendingDelete?.name ?? "" })}</p>
                </Modal.Body>
                <Modal.Footer>
                  <Button onPress={close} variant="tertiary">
                    {tActions("cancel")}
                  </Button>
                  <Button
                    onPress={() => {
                      const target = pendingDelete;

                      if (!target) return;

                      void run(
                        () => remove(target.id),
                        () => setPendingDelete(null)
                      );
                    }}
                    variant="danger"
                  >
                    {tActions("delete")}
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
