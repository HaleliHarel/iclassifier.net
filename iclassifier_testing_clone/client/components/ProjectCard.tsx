interface ProjectCardProps {
  image: string;
  title: string;
  description: string;
  size?: "large" | "small";
  imageClassName?: string;
}

export default function ProjectCard({ image, title, description, size = "large", imageClassName }: ProjectCardProps) {
  if (size === "small") {
    return (
      <div className="flex flex-col gap-3 w-full">
        <img
          src={image}
          alt={title}
          className={`w-full h-[144px] object-cover rounded-lg ${imageClassName || ""}`}
        />
        <div className="flex flex-col">
          <h3 className="text-xl font-medium leading-[150%] line-clamp-1">
            {title}
          </h3>
          <p className="text-base text-gray-700 leading-[150%] line-clamp-1">
            {description}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <img
        src={image}
        alt={title}
        className={`w-full h-[232px] object-cover rounded-lg ${imageClassName || ""}`}
      />
      <div className="flex flex-col">
        <h3 className="text-xl font-normal leading-[150%] line-clamp-1">
          {title}
        </h3>
        <p className="text-base text-gray-700 leading-[150%] line-clamp-2">
          {description}
        </p>
      </div>
    </div>
  );
}
