import { motion } from 'framer-motion';
import { Card } from './Card';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
  delay?: number;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className,
  title,
  actions,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card title={title} actions={actions} className={className}>
        {children}
      </Card>
    </motion.div>
  );
};

