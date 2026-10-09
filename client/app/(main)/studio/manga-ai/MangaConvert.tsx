"use client";

import { useState } from "react";
import { StudioHeader } from "./components/StudioHeader";
import { DrawStudio } from "./components/DrawStudio";
import { PublishMode } from "./components/PublishMode";
import StoryBoard from "./components/StoryBoard";
import { ProjectsView } from "./components/ProjectsView";
import { ProjectManagerModal } from "./components/ProjectManagerModal";
import { useMangaProjects } from "./hooks/useMangaProjects";
import type { StudioMode } from "./data";

export function MangaConverter() {
  const [mode, setMode] = useState<StudioMode>("draw");
  const [targetPage, setTargetPage] = useState<number>(1);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const {
    projects,
    activeProjectId,
    activeProject,
    selectProject,
    createProject,
    deleteProject,
    savePageData,
    addPageToProject,
    removePageFromProject,
    publishProject,
  } = useMangaProjects();

  return (
    <div className="flex flex-col h-screen bg-[#0b0612] overflow-hidden">
      {/* Top Header Bar with Project Selector */}
      <StudioHeader
        mode={mode}
        setMode={setMode}
        projectName={activeProject?.title}
        onOpenProjectManager={() => setMode("projects")}
      />

      {/* Main Mode View */}
      <div className="flex flex-1 overflow-hidden">
        {mode === "projects" && (
          <ProjectsView
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={(id) => {
              selectProject(id);
              setTargetPage(1);
            }}
            onOpenDraw={(id) => {
              selectProject(id);
              setTargetPage(1);
              setMode("draw");
            }}
            onOpenStoryBoard={(id) => {
              selectProject(id);
              setMode("storyboard");
            }}
            onOpenPublish={(id) => {
              selectProject(id);
              setMode("publish");
            }}
            onCreateProject={createProject}
            onDeleteProject={deleteProject}
          />
        )}

        {mode === "draw" && (
          <DrawStudio
            activeProject={activeProject}
            targetPage={targetPage}
            onSavePageData={savePageData}
          />
        )}

        {mode === "storyboard" && (
          <StoryBoard
            project={activeProject}
            onEditPage={(pageNum) => {
              setTargetPage(pageNum);
              setMode("draw");
            }}
            onAddPage={() => addPageToProject()}
            onRemovePage={(pageNum) => removePageFromProject(pageNum)}
            onProceedToPublish={() => setMode("publish")}
            onBack={() => setMode("draw")}
          />
        )}

        {mode === "publish" && (
          <PublishMode
            project={activeProject}
            onPublish={(projId) => publishProject(projId)}
            onBackToDraw={() => setMode("draw")}
          />
        )}
      </div>

      {/* Modal Quản lý / Chọn dự án Manga */}
      <ProjectManagerModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={(id) => {
          selectProject(id);
          setTargetPage(1);
        }}
        onCreateProject={(title, genre, desc) => {
          createProject(title, genre, desc);
          setTargetPage(1);
        }}
        onDeleteProject={deleteProject}
      />
    </div>
  );
}
