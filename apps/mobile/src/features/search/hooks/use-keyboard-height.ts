import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/** The keyboard's height while it is up, else 0. */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (event) =>
      setHeight(event.endCoordinates.height)
    );
    const hide = Keyboard.addListener("keyboardWillHide", () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
