export type Tool = {
  title: string;
  path: string;
  iconDir: string;
  descriptionShort: string;
  description: string;
};

type Tools = {
  [key: string]: Tool;
};

const tools: Tools = {
  jukugo: {
    title: "熟語パズル",
    path: "/jukugo",
    iconDir: "jukugo",
    descriptionShort: "和同開珎を自動で解きます",
    description:
      "上下左右4つの漢字から真ん中の漢字を当てるパズル、いわゆる「和同開珎」を自動で解くツール（ソルバー）です。",
  },
};


export default tools;
