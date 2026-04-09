import { useState } from "react";
import { ClientLayout } from "@/components/layout/client-layout";
import { useGetServer, useListFiles, useDeleteFile, useCreateDirectory } from "@workspace/api-client-react";
import { Folder, File, Trash2, FolderPlus, ChevronRight, Home, ArrowUp, RefreshCcw } from "lucide-react";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function ServerFiles() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [currentPath, setCurrentPath] = useState("/");
  const { data: serverData } = useGetServer({ id });
  const server = serverData?.data;
  const { data, isLoading, refetch } = useListFiles(id, { path: currentPath });
  const deleteFile = useDeleteFile();
  const createDir = useCreateDirectory();
  const { toast } = useToast();

  const files = data?.data ?? [];
  const parts = currentPath.split("/").filter(Boolean);

  function navigate(path: string) {
    setCurrentPath(path || "/");
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteFile.mutateAsync({ id, path: currentPath === "/" ? `/${name}` : `${currentPath}/${name}` });
      toast({ title: "Deleted successfully" });
      refetch();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  async function handleCreateDir() {
    const name = prompt("New folder name:");
    if (!name) return;
    try {
      await createDir.mutateAsync({ id, data: { path: currentPath === "/" ? `/${name}` : `${currentPath}/${name}` } });
      toast({ title: "Directory created" });
      refetch();
    } catch {
      toast({ title: "Failed to create directory", variant: "destructive" });
    }
  }

  return (
    <ClientLayout title={`${server?.name ?? "Server"} — Files`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">File Manager</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleCreateDir} className="flex items-center gap-2 rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground hover:bg-white/10 transition-colors">
              <FolderPlus className="h-4 w-4" />
              New Folder
            </button>
            <button onClick={() => refetch()} className="flex items-center gap-2 rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-muted-foreground hover:bg-white/10 transition-colors">
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => navigate("/")} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <Home className="h-3.5 w-3.5" />
          </button>
          {parts.map((part, i) => (
            <div key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                onClick={() => navigate("/" + parts.slice(0, i + 1).join("/"))}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {part}
              </button>
            </div>
          ))}
        </div>

        {/* File list */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Size</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Modified</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Up dir */}
              {currentPath !== "/" && (
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2.5" colSpan={4}>
                    <button
                      onClick={() => {
                        const parent = "/" + parts.slice(0, -1).join("/");
                        navigate(parent || "/");
                      }}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowUp className="h-4 w-4" />
                      <span>..</span>
                    </button>
                  </td>
                </tr>
              )}
              {isLoading ? (
                <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
              ) : files.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">Empty directory</td></tr>
              ) : (
                files.map((file: any) => (
                  <tr key={file.name} className="hover:bg-white/5 transition-colors group" data-testid={`row-file-${file.name}`}>
                    <td className="px-4 py-2.5">
                      {file.type === "directory" ? (
                        <button
                          onClick={() => navigate(currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`)}
                          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Folder className="h-4 w-4" />
                          {file.name}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-foreground">
                          <File className="h-4 w-4 text-muted-foreground" />
                          {file.name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {file.type === "directory" ? "—" : file.size ? `${(file.size / 1024).toFixed(1)} KB` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(file.name)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        data-testid={`button-delete-file-${file.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ClientLayout>
  );
}
