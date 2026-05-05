export const useJukugoUtil = () => {
  const isKanji = (character: any): boolean => {
    if (typeof character !== "string") return false;
    const regex = new RegExp("^[\u4E00-\u9FFF]$");
    return regex.test(character);
  };

  return {
    isKanji,
  };
};
