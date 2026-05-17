import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className="heroBanner">
      <div className="heroContent">
        <Heading as="h1" className="heroTitle">
          {siteConfig.title}
        </Heading>
        <p className="heroSubtitle">
          {siteConfig.tagline.split('. ').map((sentence, i, arr) => (
            <span key={i}>{sentence}{i < arr.length - 1 ? '.' : ''}<br /></span>
          ))}
        </p>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title}`}
      description={`${siteConfig.tagline}`}>
      <HomepageHeader />
    </Layout>
  );
}
