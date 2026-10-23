import { TranslateEditWorkspace } from "../../TranslateEditWorkspace";

type PageProps = {
  params: Promise<{ episodeId: string }>;
};

export default async function EpisodeEditorPage({ params }: PageProps) {
  const { episodeId } = await params;
  return (
    <section className="relative min-h-screen bg-[#07040d] text-white">
      <div className="max-w-[1500px] mx-auto px-6 py-10">
        <TranslateEditWorkspace episodeId={episodeId} />
      </div>
    </section>
  );
}
