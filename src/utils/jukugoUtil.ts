export const useJukugoUtil = () => {
  const isKanji = (character: any): boolean => {
    if (typeof character !== "string") return false;
    const regex = new RegExp("^[\u4e00-\u9fff]$");
    return regex.test(character);
  };

  return {
    isKanji,
  };
};
