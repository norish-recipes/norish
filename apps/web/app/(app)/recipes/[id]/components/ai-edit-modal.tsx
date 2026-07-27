"use client";

import { useCallback, useState } from "react";
import { Button, Label, Modal, TextArea, TextField } from "@heroui/react";
import { SparklesIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

/** Matches the `instruction` max length in RecipeAiEditInputSchema. */
const MAX_INSTRUCTION_CHARS = 2000;

interface AiEditModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (instruction: string) => void;
}

export default function AiEditModal({ isOpen, onOpenChange, onSubmit }: AiEditModalProps) {
  const t = useTranslations("recipes.aiEdit");
  const [instruction, setInstruction] = useState("");

  const trimmed = instruction.trim();
  const tooLong = trimmed.length > MAX_INSTRUCTION_CHARS;

  const handleSubmit = useCallback(() => {
    if (!trimmed || tooLong) return;
    onSubmit(trimmed);
    setInstruction("");
    onOpenChange(false);
  }, [trimmed, tooLong, onSubmit, onOpenChange]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setInstruction("");
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Container className="z-[1100]" size="lg">
        <Modal.Dialog>
          {() => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header className="flex flex-col gap-1">{t("title")}</Modal.Header>
              <Modal.Body>
                <TextField
                  fullWidth
                  value={instruction}
                  variant="secondary"
                  onChange={setInstruction}
                >
                  <Label>{t("label")}</Label>
                  <TextArea fullWidth placeholder={t("placeholder")} rows={4} />
                </TextField>
                <p className="text-muted text-xs">{t("hint")}</p>
                {tooLong && (
                  <p className="text-danger text-xs">
                    {t("maxCharacters", { max: MAX_INSTRUCTION_CHARS.toLocaleString() })}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  isDisabled={trimmed.length === 0 || tooLong}
                  variant="primary"
                  onPress={handleSubmit}
                >
                  <SparklesIcon className="h-4 w-4" />
                  {t("submit")}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
