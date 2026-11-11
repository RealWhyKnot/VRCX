type InstanceActivityTooltipProps = {
  color: string | undefined;
  displayName: string | null;
  icon: string;
  joinTime: string;
  leaveTime: string;
  duration: string;
};

const InstanceActivityTooltip = ({ color, displayName, icon, joinTime, leaveTime, duration }: InstanceActivityTooltipProps) => {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          width: "10px",
          height: "55px",
          backgroundColor: color,
          marginRight: "6px",
        }}
      />
      <div>
        <div>
          {displayName} {icon}
        </div>
        <div>
          {joinTime} - {leaveTime}
        </div>
        <div>{duration}</div>
      </div>
    </div>
  );
};

export { InstanceActivityTooltip };
