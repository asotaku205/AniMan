import { ProjectWorkspace } from "../../components/ProjectWorkspace";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function AnimProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  return (
    <section className="relative min-h-screen bg-[#07040d] text-white">
      <div className="max-w-[1500px] mx-auto px-6 py-10">
        <ProjectWorkspace projectId={projectId} />
      </div>
    </section>
  );
}
