import type { FC } from 'react';

import {
  ChatBubbleLeftRightIcon,
  FilmIcon,
  PencilSquareIcon,
  RectangleStackIcon
} from '@heroicons/react/24/outline';
import { PROFILE } from '@hey/data/tracking';
import { TabButton } from '@hey/ui';
import { Leafwatch } from '@lib/leafwatch';
import { ProfileFeedType } from 'src/enums';

import MediaFilter from './Filters/MediaFilter';

interface FeedTypeProps {
  feedType: string;
  setFeedType?: (type: ProfileFeedType) => void;
}

const FeedType: FC<FeedTypeProps> = ({ feedType, setFeedType }) => {
  const switchTab = (type: string) => {
    if (setFeedType) {
      setFeedType(type as ProfileFeedType);
    }
    Leafwatch.track(PROFILE.SWITCH_PROFILE_FEED_TAB, {
      profile_feed_type: type.toLowerCase()
    });
  };

  return (
    <div className="flex items-center justify-between">
      <div className="mt-3 flex gap-3 overflow-x-auto px-5 pb-2 sm:mt-0 sm:px-0 md:pb-0">
        <TabButton
          active={feedType === ProfileFeedType.Feed}
          icon={<PencilSquareIcon className="size-4" />}
          name="Feed"
          onClick={() => switchTab(ProfileFeedType.Feed)}
          type={ProfileFeedType.Feed.toLowerCase()}
        />
        <TabButton
          active={feedType === ProfileFeedType.Replies}
          icon={<ChatBubbleLeftRightIcon className="size-4" />}
          name="Replies"
          onClick={() => switchTab(ProfileFeedType.Replies)}
          type={ProfileFeedType.Replies.toLowerCase()}
        />
        <TabButton
          active={feedType === ProfileFeedType.Media}
          icon={<FilmIcon className="size-4" />}
          name="Media"
          onClick={() => switchTab(ProfileFeedType.Media)}
          type={ProfileFeedType.Media.toLowerCase()}
        />
        <TabButton
          active={feedType === ProfileFeedType.Collects}
          icon={<RectangleStackIcon className="size-4" />}
          name="Collected"
          onClick={() => switchTab(ProfileFeedType.Collects)}
          type={ProfileFeedType.Collects.toLowerCase()}
        />
      </div>
      {feedType === ProfileFeedType.Media ? <MediaFilter /> : null}
    </div>
  );
};

export default FeedType;
