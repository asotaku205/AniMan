export type PostType = "theory" | "art" | "clip" | "discussion" | "review" | "poll";

export const REACTIONS = [
  { k: "love", emoji: "❤️", label: "Yêu thích" },
  { k: "fire", emoji: "🔥", label: "Đỉnh" },
  { k: "sakura", emoji: "🌸", label: "Sakura" },
  { k: "cry", emoji: "😭", label: "Khóc" },
  { k: "mind", emoji: "🤯", label: "Bùng nổ" },
] as const;

export type ReactionKey = typeof REACTIONS[number]["k"];

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export type FilterTab = "new" | "hot" | "following";
export type Category = "all" | "anime" | "manga" | "novel" | "film" | "art";

export interface Post {
  id: number;
  type: PostType;
  user: string;
  color: string;
  badge: string;
  title: string;
  body?: string;
  img?: string;
  up: number;
  cm: number;
  saves: number;
  time: string;
  category: Category;
  tags?: string[];
  upvoted?: boolean;
  saved?: boolean;
  reactions?: Partial<Record<ReactionKey, number>>;
  myReaction?: ReactionKey | null;
  poll?: {
    question: string;
    options: PollOption[];
    votedId?: string | null;
  };
}

export interface Comment {
  id: number;
  user: string;
  color: string;
  text: string;
  time: string;
  likes: number;
  liked: boolean;
}