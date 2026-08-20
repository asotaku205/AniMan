export type Party = {
  id: string;
  title: string;
  media: string;
  mediaType: "Anime" | "Phim" | "Live";
  host: string;
  hostAvatar: string;
  cover: string;
  viewers: number;
  capacity: number;
  visibility: "public" | "private";
  startingIn?: string;
  status: "live" | "upcoming";
  tags: string[];
};

export type Filter = "all" | "live" | "upcoming" | "public" | "private" | "favorites";
