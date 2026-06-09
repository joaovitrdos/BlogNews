export default function Spinner() {
  return (
    <div className="flex justify-center items-center py-12" role="status" aria-label="Carregando">
      <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
