import { ProjectWorkspace } from "../../components/ProjectWorkspace";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function AnimProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  return (
    <section className="relative min-h-screen bg-[#07040d] text-white">
      <div className="w-full px-3 xl:px-4 py-3">
        <ProjectWorkspace projectId={projectId} />
      </div>
    </section>
  );
}
