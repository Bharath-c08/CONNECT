import MeetingRoomClient from "./MeetingRoomClient";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ meetingId: "room" }];
}

export default function Page() {
  return <MeetingRoomClient />;
}
